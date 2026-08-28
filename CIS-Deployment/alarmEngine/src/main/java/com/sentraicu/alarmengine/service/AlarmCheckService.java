package com.sentraicu.alarmengine.service;

import com.sentraicu.alarmengine.dto.AlarmEvent;
import com.sentraicu.alarmengine.dto.DeviceDataMessage;
import com.sentraicu.alarmengine.entity.DoctorAlarmConfig;
import com.sentraicu.alarmengine.publisher.AlarmNotifyPublisher;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Stream;

@Service
public class AlarmCheckService {

    private static final Map<String, List<String>> PARAM_ALIASES = Map.of(
            "HeartRate", List.of("HeartRate", "Pulse", "HR"),
            "Pulse", List.of("HeartRate", "Pulse", "HR"),
            "SpO2", List.of("SpO2", "SpO₂"),
            "Temp1", List.of("Temp1", "Temperature"),
            "Resp.Rate", List.of("Resp.Rate", "RespRate", "RR"),
            "PEEP", List.of("PEEP"),
            "MV", List.of("MV"),
            "Peak", List.of("Peak"),
            "VT", List.of("VT")
    );

    private final AlarmConfigCacheService configCacheService;
    private final AlarmNotifyPublisher alarmNotifyPublisher;
    private final ActiveAlarmStore activeAlarmStore;
    private final AlarmAcknowledgmentService acknowledgmentService;
    private final AlarmNotifyStateService notifyStateService;
    private final PatientInfoService patientInfoService;

    public AlarmCheckService(AlarmConfigCacheService configCacheService,
                             AlarmNotifyPublisher alarmNotifyPublisher,
                             ActiveAlarmStore activeAlarmStore,
                             AlarmAcknowledgmentService acknowledgmentService,
                             AlarmNotifyStateService notifyStateService,
                             PatientInfoService patientInfoService) {
        this.configCacheService = configCacheService;
        this.alarmNotifyPublisher = alarmNotifyPublisher;
        this.activeAlarmStore = activeAlarmStore;
        this.acknowledgmentService = acknowledgmentService;
        this.notifyStateService = notifyStateService;
        this.patientInfoService = patientInfoService;
    }

    public void processVitals(DeviceDataMessage deviceData) {
        if (deviceData == null || deviceData.getBedId() == null || deviceData.getBedId().isBlank()) {
            return;
        }
        deviceData.setBedId(BedIdUtil.canonicalAlarmBedId(deviceData.getBedId()));

        List<DoctorAlarmConfig> configs = configCacheService.getConfigsForBed(deviceData.getBedId());
        if (configs.isEmpty()) {
            return;
        }

        Map<String, Double> vitals = extractVitals(deviceData);
        Instant timestamp = parseTimestamp(deviceData.getTimestamp());

        for (DoctorAlarmConfig config : configs) {
            for (DoctorAlarmConfig.AlarmThreshold threshold : config.getAlarms()) {
                if (threshold.getEnabled() == null || !threshold.getEnabled()) {
                    continue;
                }

                Double value = resolveVitalValue(vitals, threshold.getParamName());
                if (value == null) {
                    continue;
                }

                checkThreshold(config, threshold, value, timestamp);
            }
        }
    }

    private void checkThreshold(DoctorAlarmConfig config,
                                DoctorAlarmConfig.AlarmThreshold threshold,
                                double value,
                                Instant timestamp) {
        Double high = threshold.getHighThreshold();
        Double low = threshold.getLowThreshold();
        String bedId = config.getBedId();
        String paramName = threshold.getParamName();

        boolean highBreach = high != null && value > high;
        boolean lowBreach = low != null && value < low;

        if (!highBreach && !lowBreach) {
            activeAlarmStore.clearForParam(bedId, paramName);
            notifyStateService.clearAllForParam(bedId, paramName);
            return;
        }

        if (highBreach) {
            handleActiveBreach(config, paramName, value, "HIGH", high, timestamp);
        } else {
            acknowledgmentService.clear(bedId, paramName, "HIGH");
            notifyStateService.clear(bedId, paramName, "HIGH");
        }

        if (lowBreach) {
            handleActiveBreach(config, paramName, value, "LOW", low, timestamp);
        } else {
            acknowledgmentService.clear(bedId, paramName, "LOW");
            notifyStateService.clear(bedId, paramName, "LOW");
        }
    }

    private void handleActiveBreach(DoctorAlarmConfig config,
                                    String paramName,
                                    double value,
                                    String thresholdType,
                                    double thresholdValue,
                                    Instant timestamp) {
        String bedId = config.getBedId();

        if (acknowledgmentService.isAcknowledged(bedId, paramName, thresholdType)) {
            if (acknowledgmentService.shouldEscalate(bedId, paramName, thresholdType, value)) {
                acknowledgmentService.clear(bedId, paramName, thresholdType);
                notifyStateService.clear(bedId, paramName, thresholdType);
                boolean notifyWatch = notifyStateService.markNotifiedIfNew(bedId, paramName, thresholdType);
                recordAlarm(config, paramName, value, thresholdType, thresholdValue, timestamp, notifyWatch);
            }
            return;
        }

        boolean notifyWatch = notifyStateService.markNotifiedIfNew(bedId, paramName, thresholdType);
        recordAlarm(config, paramName, value, thresholdType, thresholdValue, timestamp, notifyWatch);
    }

    private void recordAlarm(DoctorAlarmConfig config,
                             String paramName,
                             double value,
                             String thresholdType,
                             double thresholdValue,
                             Instant timestamp,
                             boolean notifyWatch) {
        AlarmEvent event = buildAlarmEvent(config, paramName, value, thresholdType, thresholdValue, timestamp);

        if (notifyWatch) {
            alarmNotifyPublisher.publish(event);
        }
        activeAlarmStore.add(event);
    }

    private AlarmEvent buildAlarmEvent(DoctorAlarmConfig config,
                                       String paramName,
                                       double value,
                                       String thresholdType,
                                       double thresholdValue,
                                       Instant timestamp) {
        AlarmEvent event = new AlarmEvent();
        event.setBedId(config.getBedId());

        Map<String, Object> patient = patientInfoService.getPatientByBed(config.getBedId());
        String patientName = firstNonBlank(
                (String) patient.get("patientName"),
                config.getPatientName()
        );
        String patientMrn = firstNonBlank(
                (String) patient.get("patientMRN"),
                config.getPatientMRN()
        );
        event.setPatientName(patientName);
        event.setPatientMRN(patientMrn);
        event.setParamName(paramName);
        event.setCurrentValue(value);
        event.setThreshold(thresholdType);
        event.setThresholdValue(thresholdValue);
        event.setSeverity(resolveSeverity(paramName, thresholdType, value));
        event.setTimestamp(Instant.now());
        return event;
    }

    private String resolveSeverity(String paramName, String thresholdType, double value) {
        if ("SpO2".equalsIgnoreCase(paramName) && "LOW".equals(thresholdType)) {
            return "CRITICAL";
        }
        if ("Temp1".equalsIgnoreCase(paramName)) {
            return "CRITICAL";
        }
        if (("HeartRate".equalsIgnoreCase(paramName) || "Pulse".equalsIgnoreCase(paramName))
                && "LOW".equals(thresholdType) && value < 40) {
            return "CRITICAL";
        }
        if (("HeartRate".equalsIgnoreCase(paramName) || "Pulse".equalsIgnoreCase(paramName))
                && "HIGH".equals(thresholdType) && value > 140) {
            return "CRITICAL";
        }
        return "WARNING";
    }

    private Map<String, Double> extractVitals(DeviceDataMessage deviceData) {
        Map<String, Double> vitals = new HashMap<>();
        Stream.of(deviceData.getPrimaryAttributes(), deviceData.getSecondaryAttributes())
                .filter(list -> list != null)
                .flatMap(List::stream)
                .forEach(attr -> {
                    if (attr.getParamName() != null && attr.getValue() != null) {
                        vitals.put(attr.getParamName(), attr.getValue());
                    }
                });
        return vitals;
    }

    private Double resolveVitalValue(Map<String, Double> vitals, String configParamName) {
        List<String> aliases = PARAM_ALIASES.getOrDefault(configParamName, List.of(configParamName));
        for (String alias : aliases) {
            if (vitals.containsKey(alias)) {
                return vitals.get(alias);
            }
        }
        return vitals.get(configParamName);
    }

    private String firstNonBlank(String primary, String fallback) {
        if (primary != null && !primary.isBlank()) {
            return primary;
        }
        return Objects.toString(fallback, null);
    }

    private Instant parseTimestamp(String timestamp) {
        if (timestamp == null || timestamp.isBlank()) {
            return Instant.now();
        }
        try {
            return Instant.parse(timestamp);
        } catch (Exception e) {
            return Instant.now();
        }
    }
}
