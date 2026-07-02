package com.rtwo.alarmengine.consumer;

import com.rtwo.alarmengine.dto.DeviceDataMessage;
import com.rtwo.alarmengine.service.AlarmCheckService;
import com.rtwo.alarmengine.service.BedIdUtil;
import com.rtwo.alarmengine.service.CisCenterService;
import com.rtwo.alarmengine.service.LatestVitalsStore;
import com.rtwo.alarmengine.service.VitalTrendBufferService;
import com.rtwo.alarmengine.service.VitalsArchiveService;
import com.rtwo.alarmengine.service.VitalsReadService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Component
public class DeviceDataConsumer {

    private static final Logger log = LoggerFactory.getLogger(DeviceDataConsumer.class);

    private final AlarmCheckService alarmCheckService;
    private final LatestVitalsStore latestVitalsStore;
    private final CisCenterService cisCenterService;
    private final VitalTrendBufferService trendBufferService;
    private final VitalsArchiveService vitalsArchiveService;

    public DeviceDataConsumer(AlarmCheckService alarmCheckService,
                              LatestVitalsStore latestVitalsStore,
                              CisCenterService cisCenterService,
                              VitalTrendBufferService trendBufferService,
                              VitalsArchiveService vitalsArchiveService) {
        this.alarmCheckService = alarmCheckService;
        this.latestVitalsStore = latestVitalsStore;
        this.cisCenterService = cisCenterService;
        this.trendBufferService = trendBufferService;
        this.vitalsArchiveService = vitalsArchiveService;
    }

    @RabbitListener(queues = "${alarm.rabbitmq.device-data-queue}")
    public void consume(DeviceDataMessage deviceData) {
        try {
            if (deviceData == null) {
                return;
            }
            if (deviceData.getBedId() == null || deviceData.getBedId().isBlank()) {
                deviceData.setBedId(resolveBedId(deviceData));
            }
            if (deviceData.getBedId() == null || deviceData.getBedId().isBlank()) {
                log.warn("Received device data without bedId, skipping");
                return;
            }
            deviceData.setBedId(BedIdUtil.canonicalAlarmBedId(deviceData.getBedId()));
            latestVitalsStore.putFromRabbit(deviceData);
            trendBufferService.record(deviceData.getBedId(), deviceData);
            vitalsArchiveService.archiveIfDue(deviceData.getBedId(), deviceData);
            alarmCheckService.processVitals(deviceData);
        } catch (Exception e) {
            log.error("Failed to process device data message: {}", e.getMessage(), e);
        }
    }

    private String resolveBedId(DeviceDataMessage deviceData) {
        for (String bedId : VitalsReadService.bedIdVariants("ICU-1-BED-01")) {
            String patientVisitId = cisCenterService.resolvePatientVisitId(bedId);
            if (patientVisitId != null && !patientVisitId.isBlank()) {
                return BedIdUtil.canonicalAlarmBedId(bedId);
            }
        }
        return null;
    }

    private String normalizeBedId(String bedId) {
        if (bedId.matches("BED-\\d+")) {
            return "ICU-1-" + bedId;
        }
        return bedId;
    }
}
