package com.rtwo.alarmengine.hub.service;

import com.rtwo.alarmengine.dto.AlarmEvent;
import com.rtwo.alarmengine.hub.entity.*;
import com.rtwo.alarmengine.hub.repo.*;
import com.rtwo.alarmengine.service.ActiveAlarmStore;
import com.rtwo.alarmengine.service.BedDeviceService;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class HubOverviewService {

    private static final String CENTER_ID = "RTWO";
    private static final Set<String> PHYSIO_PARAMS = Set.of(
            "SpO2", "Temp1", "Temp2", "Heart Rate", "HeartRate", "Pulse",
            "Resp.Rate", "Resp Rate", "HR", "FiO2", "BP", "NIBP"
    );

    private final HubUnitRepository unitRepository;
    private final HubBedRepository bedRepository;
    private final HubBedAssignmentRepository assignmentRepository;
    private final HubPatientVisitRepository visitRepository;
    private final HubPatientRepository patientRepository;
    private final ActiveAlarmStore activeAlarmStore;
    private final BedDeviceService bedDeviceService;

    public HubOverviewService(HubUnitRepository unitRepository,
                              HubBedRepository bedRepository,
                              HubBedAssignmentRepository assignmentRepository,
                              HubPatientVisitRepository visitRepository,
                              HubPatientRepository patientRepository,
                              ActiveAlarmStore activeAlarmStore,
                              BedDeviceService bedDeviceService) {
        this.unitRepository = unitRepository;
        this.bedRepository = bedRepository;
        this.assignmentRepository = assignmentRepository;
        this.visitRepository = visitRepository;
        this.patientRepository = patientRepository;
        this.activeAlarmStore = activeAlarmStore;
        this.bedDeviceService = bedDeviceService;
    }

    public Map<String, Object> getOverview() {
        return getOverview(CENTER_ID);
    }

    public Map<String, Object> getOverview(String centerId) {
        String cid = (centerId != null && !centerId.isBlank())
                ? centerId.trim().toUpperCase(java.util.Locale.ROOT)
                : CENTER_ID;
        List<HubUnitEntity> units = unitRepository.findByCenterIdOrderByNameAsc(cid);
        List<HubBedEntity> allBeds = bedRepository.findByCenterIdAndActiveTrueOrderByBedLabel(cid);
        List<AlarmEvent> activeAlarms = activeAlarmStore.getActiveAlarms();

        Map<String, HubBedEntity> bedByLabel = allBeds.stream()
                .collect(Collectors.toMap(HubBedEntity::getBedLabel, b -> b, (a, b) -> a));
        Map<String, String> alarmBedIdToLabel = new HashMap<>();
        for (HubBedEntity bed : allBeds) {
            alarmBedIdToLabel.put("ICU-1-" + bed.getBedLabel(), bed.getBedLabel());
        }

        Map<UUID, List<AlarmEvent>> alarmsByUnit = new HashMap<>();
        Map<String, List<AlarmEvent>> alarmsByBedLabel = new HashMap<>();
        int physiologicalAlarms = 0;
        int deviceAlarms = 0;

        for (AlarmEvent alarm : activeAlarms) {
            String label = alarmBedIdToLabel.getOrDefault(alarm.getBedId(),
                    bedDeviceService.resolveBedLabel(alarm.getBedId()));
            if (label != null) {
                alarmsByBedLabel.computeIfAbsent(label, k -> new ArrayList<>()).add(alarm);
                HubBedEntity bed = bedByLabel.get(label);
                if (bed != null && bed.getUnitId() != null) {
                    alarmsByUnit.computeIfAbsent(bed.getUnitId(), k -> new ArrayList<>()).add(alarm);
                }
            }
            if (isPhysiological(alarm)) {
                physiologicalAlarms++;
            } else {
                deviceAlarms++;
            }
        }

        Map<String, List<Map<String, Object>>> blocks = new LinkedHashMap<>();
        int totalBeds = 0;
        int totalOccupied = 0;
        int totalVentilated = 0;
        int totalInfusion = 0;
        int totalCritical = 0;
        int totalWarning = 0;

        int displayedUnits = 0;

        for (HubUnitEntity unit : units) {
            List<HubBedEntity> unitBeds = allBeds.stream()
                    .filter(b -> unit.getId().equals(b.getUnitId()))
                    .toList();

            if (unitBeds.isEmpty()) {
                continue;
            }

            displayedUnits++;

            int occupied = 0;
            int ventilator = 0;
            int infusion = 0;
            int critical = 0;
            int warning = 0;

            for (HubBedEntity bed : unitBeds) {
                boolean isOccupied = assignmentRepository.findByBedIdAndActiveTrue(bed.getId()).isPresent();
                if (isOccupied) occupied++;

                List<String> devices = bedDeviceService.getBedDeviceIds(bed.getBedLabel());
                if (devices.contains("BplElisa600") && isOccupied) ventilator++;
                if (devices.contains("Agilia") && isOccupied) infusion++;

                List<AlarmEvent> bedAlarms = alarmsByBedLabel.getOrDefault(bed.getBedLabel(), List.of());
                for (AlarmEvent a : bedAlarms) {
                    if (isCritical(a)) critical++;
                    else if (isWarning(a)) warning++;
                }
            }

            int unitAlarms = alarmsByUnit.getOrDefault(unit.getId(), List.of()).size();
            totalBeds += unitBeds.size();
            totalOccupied += occupied;
            totalVentilated += ventilator;
            totalInfusion += infusion;
            totalCritical += critical;
            totalWarning += warning;

            String centerDisplayName = "RTWO JPN";
            String blockKey = normalizeBlockDisplay(resolveBlockKey(unit.getBlockName(), centerDisplayName));

            Map<String, Object> unitCard = new LinkedHashMap<>();
            unitCard.put("unitId", unit.getId().toString());
            unitCard.put("code", unit.getCode());
            unitCard.put("name", unit.getName());
            unitCard.put("blockName", blockKey);
            unitCard.put("centerName", centerDisplayName);
            unitCard.put("displayLabel", HubUnitAdminService.buildDisplayLabel(unit));
            unitCard.put("bedCount", unitBeds.size());
            unitCard.put("occupiedCount", occupied);
            unitCard.put("vacantCount", Math.max(unitBeds.size() - occupied, 0));
            unitCard.put("occupancyPct", unitBeds.isEmpty() ? 0 : Math.round(100.0 * occupied / unitBeds.size()));
            unitCard.put("activeAlarmCount", unitAlarms);
            unitCard.put("criticalCount", critical);
            unitCard.put("warningCount", warning);
            unitCard.put("ventilatorCount", ventilator);
            unitCard.put("infusionCount", infusion);
            unitCard.put("riskLevel", computeRiskLevel(critical, warning, unitAlarms));
            unitCard.put("staffStrained", occupied > 4);
            unitCard.put("staffRatio", computeStaffRatio(occupied));
            unitCard.put("updatedAt", Instant.now().toString());

            blocks.computeIfAbsent(blockKey, k -> new ArrayList<>()).add(unitCard);
        }

        List<Map<String, Object>> blockList = new ArrayList<>();
        for (Map.Entry<String, List<Map<String, Object>>> entry : blocks.entrySet()) {
            Map<String, Object> block = new LinkedHashMap<>();
            block.put("blockName", entry.getKey());
            block.put("unitCount", entry.getValue().size());
            block.put("units", entry.getValue());
            blockList.add(block);
        }
        blockList.sort(this::compareBlocks);
        blockList.removeIf(b -> {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> u = (List<Map<String, Object>>) b.get("units");
            return u == null || u.isEmpty();
        });

        List<Map<String, Object>> deteriorating = buildDeterioratingPatients(
                activeAlarms, bedByLabel, alarmBedIdToLabel);

        Map<String, Object> totals = new LinkedHashMap<>();
        totals.put("bedCount", totalBeds);
        totals.put("occupiedCount", totalOccupied);
        totals.put("vacantCount", Math.max(totalBeds - totalOccupied, 0));
        totals.put("occupancyPct", totalBeds == 0 ? 0 : Math.round(100.0 * totalOccupied / totalBeds));
        totals.put("ventilatedCount", totalVentilated);
        totals.put("activeAlarmCount", activeAlarms.size());
        totals.put("physiologicalAlarmCount", physiologicalAlarms);
        totals.put("deviceAlarmCount", deviceAlarms);
        totals.put("criticalCount", totalCritical);
        totals.put("warningCount", totalWarning);
        totals.put("infusionCount", totalInfusion);

        Map<String, Object> center = new LinkedHashMap<>();
        center.put("centerId", cid);
        center.put("centerName", cid);
        center.put("location", "");
        center.put("displayName", cid);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("center", center);
        result.put("totals", totals);
        result.put("blocks", blockList);
        result.put("deterioratingPatients", deteriorating);
        result.put("activeAlarms", activeAlarms.stream().map(this::toAlarmMap).toList());
        result.put("generatedAt", Instant.now().toString());
        result.put("unitCount", displayedUnits);
        return result;
    }

    /** Block A/B are wards inside center RTWO JPN — center name must not be used as a block key. */
    private String resolveBlockKey(String blockName, String centerDisplayName) {
        if (blockName == null || blockName.isBlank()) {
            return "General";
        }
        String trimmed = blockName.trim();
        String upper = trimmed.toUpperCase();
        if (upper.equals(centerDisplayName.toUpperCase())
                || upper.equals("RTWO JPN")
                || upper.equals("RTWO")
                || upper.equals("MAIN ICU")
                || upper.equals("JPN")) {
            return "General";
        }
        return trimmed;
    }

    private String normalizeBlockDisplay(String blockKey) {
        if ("General".equalsIgnoreCase(blockKey)) return "General";
        if (blockKey.toUpperCase().startsWith("BLOCK ")) {
            return "Block " + blockKey.substring(6).trim().toUpperCase();
        }
        return blockKey;
    }

    private int compareBlocks(Map<String, Object> a, Map<String, Object> b) {
        return blockSortKey(String.valueOf(a.get("blockName")))
                .compareToIgnoreCase(blockSortKey(String.valueOf(b.get("blockName"))));
    }

    private String blockSortKey(String name) {
        String upper = name.toUpperCase();
        if (upper.equals("BLOCK A")) return "01";
        if (upper.equals("BLOCK B")) return "02";
        if (upper.equals("GENERAL")) return "99";
        return "50" + upper;
    }

    private List<Map<String, Object>> buildDeterioratingPatients(
            List<AlarmEvent> activeAlarms,
            Map<String, HubBedEntity> bedByLabel,
            Map<String, String> alarmBedIdToLabel) {

        Map<String, Map<String, Object>> byBed = new LinkedHashMap<>();
        for (AlarmEvent alarm : activeAlarms) {
            if (!isCritical(alarm) && !isWarning(alarm)) continue;

            String label = alarmBedIdToLabel.getOrDefault(alarm.getBedId(),
                    bedDeviceService.resolveBedLabel(alarm.getBedId()));
            if (label == null) continue;

            HubBedEntity bed = bedByLabel.get(label);
            String unitCode = null;
            String unitName = null;
            if (bed != null && bed.getUnitId() != null) {
                HubUnitEntity unit = unitRepository.findById(bed.getUnitId()).orElse(null);
                if (unit != null) {
                    unitCode = unit.getCode();
                    unitName = unit.getName();
                }
            }

            final String finalUnitCode = unitCode;
            final String finalUnitName = unitName;

            Map<String, Object> row = byBed.computeIfAbsent(label, k -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("bedLabel", label);
                m.put("unitCode", finalUnitCode);
                m.put("unitName", finalUnitName);
                m.put("patientName", alarm.getPatientName());
                m.put("patientMRN", alarm.getPatientMRN());
                m.put("severity", "warning");
                m.put("alarmCount", 0);
                m.put("topAlarm", null);
                return m;
            });

            int count = (int) row.get("alarmCount") + 1;
            row.put("alarmCount", count);
            if (isCritical(alarm)) {
                row.put("severity", "critical");
            }
            if (row.get("topAlarm") == null || isCritical(alarm)) {
                row.put("topAlarm", alarm.getParamName() + " " + alarm.getThreshold());
            }
            if (alarm.getPatientName() != null) {
                row.put("patientName", alarm.getPatientName());
            }
            if (alarm.getPatientMRN() != null) {
                row.put("patientMRN", alarm.getPatientMRN());
            }

            if (bed != null) {
                assignmentRepository.findByBedIdAndActiveTrue(bed.getId()).ifPresent(a -> {
                    visitRepository.findById(a.getVisitId()).ifPresent(v -> {
                        patientRepository.findById(v.getPatientId()).ifPresent(p -> {
                            row.put("patientName", p.getFullName());
                            row.put("patientMRN", p.getMrn());
                        });
                    });
                });
            }
        }

        return byBed.values().stream()
                .sorted((a, b) -> {
                    int sa = "critical".equals(a.get("severity")) ? 0 : 1;
                    int sb = "critical".equals(b.get("severity")) ? 0 : 1;
                    if (sa != sb) return Integer.compare(sa, sb);
                    return Integer.compare((int) b.get("alarmCount"), (int) a.get("alarmCount"));
                })
                .toList();
    }

    private Map<String, Object> toAlarmMap(AlarmEvent a) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("bedId", a.getBedId());
        m.put("bedLabel", bedDeviceService.resolveBedLabel(a.getBedId()));
        m.put("patientName", a.getPatientName());
        m.put("patientMRN", a.getPatientMRN());
        m.put("paramName", a.getParamName());
        m.put("currentValue", a.getCurrentValue());
        m.put("threshold", a.getThreshold());
        m.put("thresholdValue", a.getThresholdValue());
        m.put("severity", a.getSeverity());
        m.put("timestamp", a.getTimestamp() != null ? a.getTimestamp().toString() : null);
        m.put("alarmType", isPhysiological(a) ? "physiological" : "device");
        m.put("title", buildAlarmTitle(a));
        m.put("acknowledged", false);
        return m;
    }

    private String buildAlarmTitle(AlarmEvent a) {
        String param = a.getParamName() != null ? a.getParamName() : "Alarm";
        if ("LOW".equals(a.getThreshold())) {
            return param + " below limit";
        }
        if ("HIGH".equals(a.getThreshold())) {
            return param + " above limit";
        }
        return param + " alarm";
    }

    private boolean isPhysiological(AlarmEvent a) {
        return a.getParamName() != null && PHYSIO_PARAMS.stream()
                .anyMatch(p -> p.equalsIgnoreCase(a.getParamName()));
    }

    private boolean isCritical(AlarmEvent a) {
        if ("critical".equalsIgnoreCase(a.getSeverity())) return true;
        return "SpO2".equalsIgnoreCase(a.getParamName()) || "Temp1".equalsIgnoreCase(a.getParamName());
    }

    private boolean isWarning(AlarmEvent a) {
        if ("warning".equalsIgnoreCase(a.getSeverity())) return true;
        return !isCritical(a);
    }

    private String computeRiskLevel(int critical, int warning, int alarmCount) {
        if (critical > 0 || alarmCount >= 3) return "HIGH";
        if (warning > 0 || alarmCount > 0) return "MODERATE";
        return "LOW";
    }

    private String computeStaffRatio(int occupied) {
        if (occupied <= 0) return "1:0";
        int nurses = Math.max(1, (int) Math.ceil(occupied / 4.0));
        int ratio = (int) Math.ceil((double) occupied / nurses);
        return "1:" + ratio;
    }
}
