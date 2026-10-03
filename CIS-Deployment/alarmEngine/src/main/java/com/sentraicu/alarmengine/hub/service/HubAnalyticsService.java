package com.sentraicu.alarmengine.hub.service;

import com.sentraicu.alarmengine.dto.AlarmEvent;
import com.sentraicu.alarmengine.hub.HubCenterIds;
import com.sentraicu.alarmengine.hub.entity.*;
import com.sentraicu.alarmengine.hub.repo.*;
import com.sentraicu.alarmengine.service.ActiveAlarmStore;
import com.sentraicu.alarmengine.service.BedDeviceService;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class HubAnalyticsService {

    private static final String CENTER_ID = HubCenterIds.CONNECT_ENGINE;
    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    private final HubOverviewService overviewService;
    private final HubUnitRepository unitRepository;
    private final HubBedRepository bedRepository;
    private final HubBedAssignmentRepository assignmentRepository;
    private final HubPatientVisitRepository visitRepository;
    private final HubPatientRepository patientRepository;
    private final HubOrderRepository orderRepository;
    private final HubFluidEntryRepository fluidRepository;
    private final HubLabResultRepository labRepository;
    private final HubScoreSnapshotRepository scoreRepository;
    private final ActiveAlarmStore activeAlarmStore;
    private final BedDeviceService bedDeviceService;

    public HubAnalyticsService(HubOverviewService overviewService,
                               HubUnitRepository unitRepository,
                               HubBedRepository bedRepository,
                               HubBedAssignmentRepository assignmentRepository,
                               HubPatientVisitRepository visitRepository,
                               HubPatientRepository patientRepository,
                               HubOrderRepository orderRepository,
                               HubFluidEntryRepository fluidRepository,
                               HubLabResultRepository labRepository,
                               HubScoreSnapshotRepository scoreRepository,
                               ActiveAlarmStore activeAlarmStore,
                               BedDeviceService bedDeviceService) {
        this.overviewService = overviewService;
        this.unitRepository = unitRepository;
        this.bedRepository = bedRepository;
        this.assignmentRepository = assignmentRepository;
        this.visitRepository = visitRepository;
        this.patientRepository = patientRepository;
        this.orderRepository = orderRepository;
        this.fluidRepository = fluidRepository;
        this.labRepository = labRepository;
        this.scoreRepository = scoreRepository;
        this.activeAlarmStore = activeAlarmStore;
        this.bedDeviceService = bedDeviceService;
    }

    public Map<String, Object> getCenterAnalytics() {
        return getCenterAnalytics(CENTER_ID);
    }

    public Map<String, Object> getCenterAnalytics(String centerId) {
        String cid = (centerId != null && !centerId.isBlank())
                ? centerId.trim().toUpperCase(Locale.ROOT)
                : CENTER_ID;
        Instant now = Instant.now();
        Instant dayStart = LocalDate.now(IST).atStartOfDay(IST).toInstant();
        Instant last24h = now.minus(24, ChronoUnit.HOURS);

        Map<String, Object> overview = overviewService.getOverview(cid);
        @SuppressWarnings("unchecked")
        Map<String, Object> totals = (Map<String, Object>) overview.get("totals");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> blocks = (List<Map<String, Object>>) overview.get("blocks");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> deteriorating = (List<Map<String, Object>>) overview.getOrDefault(
                "deterioratingPatients", List.of());

        List<HubBedEntity> allBeds = bedRepository.findByCenterIdAndActiveTrueOrderByBedLabel(cid);
        Set<UUID> centerBedIds = allBeds.stream().map(HubBedEntity::getId).collect(Collectors.toSet());
        List<HubBedAssignmentEntity> activeAssignments = assignmentRepository.findByActiveTrue().stream()
                .filter(a -> centerBedIds.contains(a.getBedId()))
                .toList();
        Set<UUID> activeVisitIds = activeAssignments.stream()
                .map(HubBedAssignmentEntity::getVisitId)
                .collect(Collectors.toSet());

        Map<UUID, HubBedEntity> bedById = allBeds.stream()
                .collect(Collectors.toMap(HubBedEntity::getId, b -> b, (a, b) -> a));
        Map<UUID, HubUnitEntity> unitById = unitRepository.findByCenterIdOrderByNameAsc(cid).stream()
                .collect(Collectors.toMap(HubUnitEntity::getId, u -> u, (a, b) -> a));

        List<Map<String, Object>> census = buildCensus(activeAssignments, bedById, unitById);
        Map<String, Object> scoring = buildScoringAnalytics(activeVisitIds, census);
        Map<String, Object> orders = buildOrderAnalytics(activeVisitIds, last24h);
        Map<String, Object> fluids = buildFluidAnalytics(activeVisitIds, last24h);
        Map<String, Object> labs = buildLabAnalytics(activeVisitIds, last24h);
        Map<String, Object> alarms = buildAlarmAnalytics(activeAlarmStore.getActiveAlarms(), allBeds);
        Map<String, Object> throughput = buildThroughput(activeVisitIds, dayStart, last24h, census, cid);
        Instant last7d = now.minus(7, ChronoUnit.DAYS);
        Instant last30d = now.minus(30, ChronoUnit.DAYS);
        Map<String, Object> discharges = buildDischargeAnalytics(last24h, last7d, last30d, unitById, cid);
        Map<String, Object> devices = buildDeviceFleet(allBeds, activeAssignments, totals);
        List<Map<String, Object>> unitAnalytics = buildUnitAnalytics(blocks, scoring, census);
        List<Map<String, Object>> riskMatrix = buildRiskMatrix(census, scoring, deteriorating);
        List<Map<String, Object>> executiveKpis = buildExecutiveKpis(
                totals, scoring, orders, fluids, labs, alarms, throughput, devices, discharges);
        List<String> insights = buildInsights(totals, scoring, orders, alarms, throughput, devices, discharges);
        List<Map<String, Object>> hourlyOccupancy = buildHourlyOccupancyTrend(census, last24h, now);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("center", overview.get("center"));
        result.put("generatedAt", now.toString());
        result.put("executiveKpis", executiveKpis);
        result.put("operations", buildOperations(totals, devices, throughput));
        result.put("clinicalQuality", scoring);
        result.put("throughput", throughput);
        result.put("discharges", discharges);
        result.put("orders", orders);
        result.put("fluids", fluids);
        result.put("labs", labs);
        result.put("alarms", alarms);
        result.put("devices", devices);
        result.put("units", unitAnalytics);
        result.put("riskMatrix", riskMatrix);
        result.put("scoreDistribution", scoring.get("distribution"));
        result.put("hourlyTrends", Map.of(
                "occupancy", hourlyOccupancy,
                "alarmVolume", alarms.get("hourlyBuckets")
        ));
        result.put("insights", insights);
        result.put("deterioratingPatients", deteriorating);
        return result;
    }

    private List<Map<String, Object>> buildCensus(List<HubBedAssignmentEntity> assignments,
                                                  Map<UUID, HubBedEntity> bedById,
                                                  Map<UUID, HubUnitEntity> unitById) {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (HubBedAssignmentEntity a : assignments) {
            HubBedEntity bed = bedById.get(a.getBedId());
            if (bed == null) continue;
            HubPatientVisitEntity visit = visitRepository.findById(a.getVisitId()).orElse(null);
            if (visit == null) continue;
            HubPatientEntity patient = patientRepository.findById(visit.getPatientId()).orElse(null);
            if (patient == null) continue;

            HubUnitEntity unit = bed.getUnitId() != null ? unitById.get(bed.getUnitId()) : null;
            long losHours = ChronoUnit.HOURS.between(visit.getAdmittedAt(), Instant.now());

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("visitId", visit.getId().toString());
            row.put("patientId", patient.getId().toString());
            row.put("patientName", patient.getFullName());
            row.put("mrn", patient.getMrn());
            row.put("bedLabel", bed.getBedLabel());
            row.put("bedId", "ICU-1-" + bed.getBedLabel());
            row.put("unitId", bed.getUnitId() != null ? bed.getUnitId().toString() : null);
            row.put("unitName", unit != null ? unit.getName() : "");
            row.put("unitCode", unit != null ? unit.getCode() : "");
            row.put("admittedAt", visit.getAdmittedAt().toString());
            row.put("losHours", losHours);
            row.put("losDays", round1(losHours / 24.0));
            row.put("primaryDiagnosis", visit.getPrimaryDiagnosis());
            row.put("isolation", visit.getIsolationFlags() != null && !visit.getIsolationFlags().isEmpty());
            // Used to be bedDeviceService.getBedDeviceIds(...).contains("BplElisa600"/"Agilia")
            // — the pre-rebrand device catalog, whose fallback fires for any
            // admitted-and-"virtual" bed regardless of what's really
            // connected, so every patient here showed as both ventilated and
            // on infusion (this fed real risk scoring in buildRiskMatrix()
            // too — every patient's computed risk was inflated by the
            // ventilated +15 weight). The admission form's own clinical
            // snapshot has a real "ventilated" flag entered at admission;
            // there's no real signal for "an infusion pump is physically
            // connected" today, so "inotropes" (a specific vasoactive-
            // medication flag, not a perfect match but a real one) stands in
            // instead, renamed so the field says what it actually measures.
            Map<String, Object> snapshot = visit.getClinicalSnapshot();
            row.put("ventilated", snapshot != null && Boolean.TRUE.equals(snapshot.get("ventilated")));
            row.put("onInotropes", snapshot != null && Boolean.TRUE.equals(snapshot.get("inotropes")));
            rows.add(row);
        }
        return rows;
    }

    private Map<String, Object> buildScoringAnalytics(Set<UUID> activeVisitIds,
                                                      List<Map<String, Object>> census) {
        Map<String, Object> result = new LinkedHashMap<>();
        List<String> scoreTypes = List.of("NEWS2", "SOFA", "APACHE_II", "RASS", "CAM_ICU");

        Map<String, Map<String, Integer>> distribution = new LinkedHashMap<>();
        for (String type : scoreTypes) {
            distribution.put(type, new LinkedHashMap<>(Map.of("LOW", 0, "MEDIUM", 0, "HIGH", 0, "NONE", 0)));
        }

        double newsSum = 0, sofaSum = 0, apacheSum = 0;
        int newsCount = 0, sofaCount = 0, apacheCount = 0;
        int highRisk = 0, camPositive = 0, scoredPatients = 0;

        Map<String, Map<String, Object>> latestByVisit = new HashMap<>();
        for (UUID visitId : activeVisitIds) {
            boolean hasAny = false;
            Map<String, Object> latest = new LinkedHashMap<>();
            for (String type : scoreTypes) {
                scoreRepository.findTop1ByVisitIdAndScoreTypeOrderByCalculatedAtDesc(visitId, type)
                        .ifPresent(s -> {
                            latest.put(type, snapshotSummary(s));
                            bucketScore(distribution, type, s);
                        });
                if (latest.containsKey(type)) hasAny = true;
            }
            if (hasAny) {
                scoredPatients++;
                latestByVisit.put(visitId.toString(), latest);
            }

            if (latest.containsKey("NEWS2")) {
                double v = toDouble(((Map<?, ?>) latest.get("NEWS2")).get("totalScore"));
                newsSum += v;
                newsCount++;
                if (v >= 7) highRisk++;
            }
            if (latest.containsKey("SOFA")) {
                double v = toDouble(((Map<?, ?>) latest.get("SOFA")).get("totalScore"));
                sofaSum += v;
                sofaCount++;
                if (v >= 6) highRisk++;
            }
            if (latest.containsKey("APACHE_II")) {
                double v = toDouble(((Map<?, ?>) latest.get("APACHE_II")).get("totalScore"));
                apacheSum += v;
                apacheCount++;
                if (v >= 15) highRisk++;
            }
            if (latest.containsKey("CAM_ICU")) {
                double v = toDouble(((Map<?, ?>) latest.get("CAM_ICU")).get("totalScore"));
                if (v >= 1) camPositive++;
            }
        }

        for (Map<String, Object> row : census) {
            row.put("latestScores", latestByVisit.getOrDefault(row.get("visitId"), Map.of()));
        }

        result.put("scoredPatients", scoredPatients);
        result.put("highRiskPatients", highRisk);
        result.put("camPositiveCount", camPositive);
        result.put("avgNews2", newsCount > 0 ? round1(newsSum / newsCount) : null);
        result.put("avgSofa", sofaCount > 0 ? round1(sofaSum / sofaCount) : null);
        result.put("avgApacheII", apacheCount > 0 ? round1(apacheSum / apacheCount) : null);
        result.put("distribution", distribution);
        result.put("coveragePct", activeVisitIds.isEmpty() ? 0
                : Math.round(100.0 * scoredPatients / activeVisitIds.size()));
        return result;
    }

    private void bucketScore(Map<String, Map<String, Integer>> distribution, String type,
                             HubScoreSnapshotEntity s) {
        Map<String, Integer> bucket = distribution.get(type);
        if (bucket == null) return;
        String risk = s.getRiskLevel() != null ? s.getRiskLevel().toUpperCase(Locale.ROOT) : "LOW";
        if (risk.contains("HIGH")) bucket.merge("HIGH", 1, Integer::sum);
        else if (risk.contains("MEDIUM") || risk.contains("LOW_MEDIUM")) bucket.merge("MEDIUM", 1, Integer::sum);
        else bucket.merge("LOW", 1, Integer::sum);
    }

    private Map<String, Object> snapshotSummary(HubScoreSnapshotEntity s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("totalScore", s.getTotalScore());
        m.put("riskLevel", s.getRiskLevel());
        m.put("interpretation", s.getInterpretation());
        m.put("calculatedAt", s.getCalculatedAt().toString());
        return m;
    }

    private Map<String, Object> buildOrderAnalytics(Set<UUID> activeVisitIds, Instant since) {
        List<HubOrderEntity> all = orderRepository.findAll();
        int active = 0, stat = 0, routine = 0, discontinued24h = 0;
        Map<String, Integer> byType = new LinkedHashMap<>();
        Map<String, Integer> byStatus = new LinkedHashMap<>();

        for (HubOrderEntity o : all) {
            if (!activeVisitIds.contains(o.getVisitId())) continue;
            String status = o.getStatus() != null ? o.getStatus().toUpperCase(Locale.ROOT) : "";
            byStatus.merge(status, 1, Integer::sum);
            if ("DISCONTINUED".equals(status) || "COMPLETED".equals(status)) {
                if (o.getDiscontinuedAt() != null && o.getDiscontinuedAt().isAfter(since)) discontinued24h++;
                continue;
            }
            active++;
            if ("STAT".equalsIgnoreCase(o.getPriority())) stat++;
            else routine++;
            String type = o.getOrderType() != null ? o.getOrderType() : "OTHER";
            byType.merge(type, 1, Integer::sum);
        }

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("activeCount", active);
        m.put("statCount", stat);
        m.put("routineCount", routine);
        m.put("discontinued24h", discontinued24h);
        m.put("byType", byType);
        m.put("byStatus", byStatus);
        return m;
    }

    private Map<String, Object> buildFluidAnalytics(Set<UUID> activeVisitIds, Instant since) {
        double intake = 0, output = 0;
        int running = 0;
        for (HubFluidEntryEntity f : fluidRepository.findAll()) {
            if (!activeVisitIds.contains(f.getVisitId())) continue;
            if ("RUNNING".equalsIgnoreCase(f.getIntakeMode()) && f.getStoppedAt() == null) running++;
            if (f.getRecordedAt() == null || f.getRecordedAt().isBefore(since)) continue;
            double vol = f.getVolumeMl() != null ? f.getVolumeMl().doubleValue() : 0;
            if ("INTAKE".equalsIgnoreCase(f.getEntryType())) intake += vol;
            else if ("OUTPUT".equalsIgnoreCase(f.getEntryType())) output += vol;
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("runningInfusions", running);
        m.put("intake24hMl", round0(intake));
        m.put("output24hMl", round0(output));
        m.put("netBalanceMl", round0(intake - output));
        return m;
    }

    private Map<String, Object> buildLabAnalytics(Set<UUID> activeVisitIds, Instant since) {
        int total = 0, critical = 0;
        Map<String, Integer> byTest = new LinkedHashMap<>();
        for (HubLabResultEntity lab : labRepository.findAll()) {
            if (!activeVisitIds.contains(lab.getVisitId())) continue;
            if (lab.getResultedAt() == null || lab.getResultedAt().isBefore(since)) continue;
            total++;
            String flag = lab.getFlag() != null ? lab.getFlag().toUpperCase(Locale.ROOT) : "";
            if (flag.contains("HIGH") || flag.contains("LOW") || flag.contains("CRITICAL")) critical++;
            String test = lab.getTestName() != null ? lab.getTestName() : "Unknown";
            byTest.merge(test, 1, Integer::sum);
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("results24h", total);
        m.put("abnormal24h", critical);
        m.put("topTests", byTest.entrySet().stream()
                .sorted((a, b) -> Integer.compare(b.getValue(), a.getValue()))
                .limit(8)
                .map(e -> Map.<String, Object>of("testName", e.getKey(), "count", e.getValue()))
                .toList());
        return m;
    }

    private Map<String, Object> buildAlarmAnalytics(List<AlarmEvent> alarms, List<HubBedEntity> beds) {
        Set<String> labels = beds.stream()
                .map(HubBedEntity::getBedLabel)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        List<AlarmEvent> scoped = alarms.stream()
                .filter(a -> {
                    String label = bedDeviceService.resolveBedLabel(a.getBedId());
                    return label != null && labels.contains(label);
                })
                .toList();
        Map<String, Integer> byParam = new LinkedHashMap<>();
        Map<String, Integer> byUnit = new LinkedHashMap<>();
        int critical = 0, warning = 0;

        Map<String, UUID> unitByBedLabel = new HashMap<>();
        for (HubBedEntity bed : beds) {
            if (bed.getUnitId() != null) unitByBedLabel.put(bed.getBedLabel(), bed.getUnitId());
        }
        Map<UUID, String> unitNames = unitRepository.findByCenterIdOrderByNameAsc(
                beds.isEmpty() ? CENTER_ID : beds.get(0).getCenterId()).stream()
                .collect(Collectors.toMap(HubUnitEntity::getId, HubUnitEntity::getName, (a, b) -> a));

        Instant now = Instant.now();
        int[] hourly = new int[24];
        for (AlarmEvent a : scoped) {
            String sev = a.getSeverity() != null ? a.getSeverity().toLowerCase(Locale.ROOT) : "";
            if (sev.contains("critical")) critical++;
            else warning++;

            String param = a.getParamName() != null ? a.getParamName() : "Other";
            byParam.merge(param, 1, Integer::sum);

            String label = bedDeviceService.resolveBedLabel(a.getBedId());
            UUID unitId = label != null ? unitByBedLabel.get(label) : null;
            String unitName = unitId != null ? unitNames.getOrDefault(unitId, "Unknown") : "Unknown";
            byUnit.merge(unitName, 1, Integer::sum);

            if (a.getTimestamp() != null) {
                long hoursAgo = ChronoUnit.HOURS.between(a.getTimestamp(), now);
                if (hoursAgo >= 0 && hoursAgo < 24) {
                    hourly[23 - (int) hoursAgo]++;
                } else {
                    hourly[23]++;
                }
            } else {
                hourly[23]++;
            }
        }

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("active", scoped.size());
        m.put("critical", critical);
        m.put("warning", warning);
        m.put("byParam", toSortedList(byParam, 10));
        m.put("byUnit", toSortedList(byUnit, 10));
        m.put("hourlyBuckets", hourlyList(hourly));
        return m;
    }

    private Map<String, Object> buildThroughput(Set<UUID> activeVisitIds, Instant dayStart,
                                                Instant last24h, List<Map<String, Object>> census,
                                                String centerId) {
        int admissions24h = 0, discharges24h = 0, isolation = 0;
        double losSum = 0;
        for (Map<String, Object> row : census) {
            Instant admitted = Instant.parse(row.get("admittedAt").toString());
            if (admitted.isAfter(last24h)) admissions24h++;
            losSum += toDouble(row.get("losHours"));
            if (Boolean.TRUE.equals(row.get("isolation"))) isolation++;
        }
        for (HubPatientVisitEntity v : visitRepository.findAll()) {
            if (v.getDischargedAt() != null && v.getDischargedAt().isAfter(last24h)
                    && visitInCenter(v.getId(), centerId)) {
                discharges24h++;
            }
        }

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("activeCensus", activeVisitIds.size());
        m.put("admissions24h", admissions24h);
        m.put("discharges24h", discharges24h);
        m.put("avgLosHours", census.isEmpty() ? 0 : round1(losSum / census.size()));
        m.put("avgLosDays", census.isEmpty() ? 0 : round1(losSum / census.size() / 24.0));
        m.put("isolationCount", isolation);
        m.put("turnoverIndex", round1(admissions24h + discharges24h));
        return m;
    }

    private Map<String, Object> buildDischargeAnalytics(Instant last24h, Instant last7d,
                                                        Instant last30d,
                                                        Map<UUID, HubUnitEntity> unitById,
                                                        String centerId) {
        List<HubPatientVisitEntity> allDischarged =
                visitRepository.findByStatusOrderByDischargedAtDesc("DISCHARGED").stream()
                        .filter(v -> visitInCenter(v.getId(), centerId))
                        .toList();

        int discharges24h = 0;
        int discharges7d = 0;
        double losSum30d = 0;
        int losCount30d = 0;
        Map<String, Integer> byDestination = new LinkedHashMap<>();
        List<Map<String, Object>> recent = new ArrayList<>();

        for (HubPatientVisitEntity visit : allDischarged) {
            Instant dischargedAt = visit.getDischargedAt();
            if (dischargedAt == null) continue;

            if (dischargedAt.isAfter(last24h)) discharges24h++;
            if (dischargedAt.isAfter(last7d)) discharges7d++;

            if (dischargedAt.isAfter(last30d) && visit.getAdmittedAt() != null) {
                long hrs = ChronoUnit.HOURS.between(visit.getAdmittedAt(), dischargedAt);
                losSum30d += hrs / 24.0;
                losCount30d++;
            }

            String dest = visit.getDischargeDestination();
            String destKey = (dest != null && !dest.isBlank()) ? dest.trim() : "Not specified";
            byDestination.merge(destKey, 1, Integer::sum);

            if (recent.size() < 25) {
                recent.add(toDischargeRow(visit, unitById));
            }
        }

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("totalDischarged", allDischarged.size());
        m.put("discharges24h", discharges24h);
        m.put("discharges7d", discharges7d);
        m.put("avgLosAtDischargeDays", losCount30d == 0 ? 0 : round1(losSum30d / losCount30d));
        m.put("byDestination", toSortedList(byDestination, 8));
        m.put("dailyTrend", buildDischargeDayTrend(allDischarged));
        m.put("recent", recent);
        return m;
    }

    private List<Map<String, Object>> buildDischargeDayTrend(List<HubPatientVisitEntity> discharged) {
        List<Map<String, Object>> buckets = new ArrayList<>();
        LocalDate today = LocalDate.now(IST);
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("M/d");
        for (int i = 6; i >= 0; i--) {
            LocalDate day = today.minusDays(i);
            Instant start = day.atStartOfDay(IST).toInstant();
            Instant end = day.plusDays(1).atStartOfDay(IST).toInstant();
            int count = 0;
            for (HubPatientVisitEntity v : discharged) {
                Instant at = v.getDischargedAt();
                if (at != null && !at.isBefore(start) && at.isBefore(end)) count++;
            }
            Map<String, Object> point = new LinkedHashMap<>();
            point.put("label", day.format(fmt));
            point.put("value", count);
            buckets.add(point);
        }
        return buckets;
    }

    private Map<String, Object> toDischargeRow(HubPatientVisitEntity visit,
                                               Map<UUID, HubUnitEntity> unitById) {
        HubPatientEntity patient = patientRepository.findById(visit.getPatientId()).orElse(null);
        HubBedEntity bed = assignmentRepository.findByVisitIdAndActiveTrue(visit.getId())
                .or(() -> assignmentRepository.findFirstByVisitIdOrderByAssignedAtDesc(visit.getId()))
                .flatMap(a -> bedRepository.findById(a.getBedId()))
                .orElse(null);

        HubUnitEntity unit = bed != null && bed.getUnitId() != null
                ? unitById.get(bed.getUnitId()) : null;

        Instant dischargedAt = visit.getDischargedAt();
        long losHours = (visit.getAdmittedAt() != null && dischargedAt != null)
                ? ChronoUnit.HOURS.between(visit.getAdmittedAt(), dischargedAt) : 0;

        String diagnosis = visit.getPrimaryDiagnosis();
        if (diagnosis == null || diagnosis.isBlank()) {
            diagnosis = visit.getProvisionalDiagnosis();
        }

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("visitId", visit.getId().toString());
        row.put("patientName", patient != null ? patient.getFullName() : "—");
        row.put("mrn", patient != null ? patient.getMrn() : "—");
        row.put("bedLabel", bed != null ? bed.getBedLabel() : "—");
        row.put("unitName", unit != null ? unit.getName() : "—");
        row.put("unitCode", unit != null ? unit.getCode() : "");
        row.put("admittedAt", visit.getAdmittedAt() != null ? visit.getAdmittedAt().toString() : null);
        row.put("dischargedAt", dischargedAt != null ? dischargedAt.toString() : null);
        row.put("losDays", round1(losHours / 24.0));
        row.put("primaryDiagnosis", diagnosis != null ? diagnosis : "");
        row.put("dischargeReason", truncateText(visit.getDischargeReason(), 120));
        row.put("dischargeDestination", visit.getDischargeDestination());
        row.put("followUpPlan", truncateText(visit.getFollowUpPlan(), 120));
        return row;
    }

    private String truncateText(String value, int max) {
        if (value == null || value.isBlank()) return "";
        String t = value.trim();
        return t.length() <= max ? t : t.substring(0, max) + "…";
    }

    private Map<String, Object> buildDeviceFleet(List<HubBedEntity> beds,
                                                 List<HubBedAssignmentEntity> assignments,
                                                 Map<String, Object> totals) {
        Set<UUID> occupiedBedIds = assignments.stream()
                .map(HubBedAssignmentEntity::getBedId)
                .collect(Collectors.toSet());
        int monitorTotal = beds.size();

        // ventilators/infusionPumps used to come from bedDeviceService
        // .getBedDeviceIds(...).contains("BplElisa600"/"Agilia") — the
        // pre-rebrand device catalog, whose fallback fires for any bed
        // that's admitted-and-"virtual" (essentially every bed today)
        // regardless of what's actually connected, so this counted every
        // single bed in the hospital as owning both a ventilator and an
        // infusion pump. Unlike the per-patient ventilated/onInotropes
        // flags above, there's no real substitute for this one: it's asking
        // "how much equipment does the hospital physically own," and
        // nothing in this system tracks device inventory — deviceIngestion
        // knows what's connected to which bed right now, not what's owned
        // or in storage. Reporting a fabricated number here would be worse
        // than reporting none, so this stays at zero until real equipment
        // tracking exists rather than resurrect a different guess.
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("monitors", Map.of("total", monitorTotal, "inUse", occupiedBedIds.size(),
                "utilizationPct", beds.isEmpty() ? 0 : Math.round(100.0 * occupiedBedIds.size() / beds.size())));
        m.put("ventilators", deviceBlock(0, 0));
        m.put("infusionPumps", deviceBlock(0, 0));
        m.put("ventilatedPatients", totals.getOrDefault("ventilatedCount", 0));
        m.put("inotropesPatients", totals.getOrDefault("inotropesCount", 0));
        return m;
    }

    private Map<String, Object> deviceBlock(int total, int inUse) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("total", total);
        m.put("inUse", inUse);
        m.put("available", Math.max(total - inUse, 0));
        m.put("utilizationPct", total == 0 ? 0 : Math.round(100.0 * inUse / total));
        return m;
    }

    private Map<String, Object> buildOperations(Map<String, Object> totals,
                                                Map<String, Object> devices,
                                                Map<String, Object> throughput) {
        int bedCount = toInt(totals.get("bedCount"));
        int occupied = toInt(totals.get("occupiedCount"));
        int occupancyPct = toInt(totals.get("occupancyPct"));

        String capacityStatus = occupancyPct >= 90 ? "CRITICAL"
                : occupancyPct >= 75 ? "ELEVATED" : occupancyPct >= 50 ? "OPTIMAL" : "LOW";

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("bedCount", bedCount);
        m.put("occupiedCount", occupied);
        m.put("vacantCount", totals.get("vacantCount"));
        m.put("occupancyPct", occupancyPct);
        m.put("capacityStatus", capacityStatus);
        m.put("ventilatorUtilizationPct", ((Map<?, ?>) devices.get("ventilators")).get("utilizationPct"));
        m.put("infusionUtilizationPct", ((Map<?, ?>) devices.get("infusionPumps")).get("utilizationPct"));
        m.put("staffLoadIndex", occupied <= 0 ? 0 : Math.min(100, Math.round(occupied * 12.5)));
        m.put("census", throughput.get("activeCensus"));
        return m;
    }

    private List<Map<String, Object>> buildUnitAnalytics(List<Map<String, Object>> blocks,
                                                          Map<String, Object> scoring,
                                                          List<Map<String, Object>> census) {
        List<Map<String, Object>> units = new ArrayList<>();
        if (blocks == null) return units;

        for (Map<String, Object> block : blocks) {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> blockUnits = (List<Map<String, Object>>) block.get("units");
            if (blockUnits == null) continue;
            for (Map<String, Object> u : blockUnits) {
                String unitId = String.valueOf(u.get("unitId"));
                List<Map<String, Object>> unitPatients = census.stream()
                        .filter(c -> unitId.equals(String.valueOf(c.get("unitId"))))
                        .toList();

                double avgLos = unitPatients.stream()
                        .mapToDouble(c -> toDouble(c.get("losDays")))
                        .average().orElse(0);

                int highRisk = 0;
                for (Map<String, Object> p : unitPatients) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> scores = (Map<String, Object>) p.getOrDefault("latestScores", Map.of());
                    if (isHighRiskScores(scores)) highRisk++;
                }

                Map<String, Object> enriched = new LinkedHashMap<>(u);
                enriched.put("patientCount", unitPatients.size());
                enriched.put("avgLosDays", round1(avgLos));
                enriched.put("highRiskCount", highRisk);
                enriched.put("compositeScore", computeUnitComposite(u, highRisk));
                units.add(enriched);
            }
        }
        units.sort((a, b) -> Integer.compare(
                toInt(b.get("compositeScore")), toInt(a.get("compositeScore"))));
        return units;
    }

    private int computeUnitComposite(Map<String, Object> unit, int highRisk) {
        int score = 0;
        score += toInt(unit.get("criticalCount")) * 15;
        score += toInt(unit.get("warningCount")) * 5;
        score += toInt(unit.get("activeAlarmCount")) * 3;
        score += highRisk * 10;
        score += toInt(unit.get("occupancyPct")) / 5;
        return score;
    }

    private List<Map<String, Object>> buildRiskMatrix(List<Map<String, Object>> census,
                                                      Map<String, Object> scoring,
                                                      List<Map<String, Object>> deteriorating) {
        Set<String> deterioratingBeds = deteriorating.stream()
                .map(d -> String.valueOf(d.get("bedLabel")))
                .collect(Collectors.toSet());

        List<Map<String, Object>> matrix = new ArrayList<>();
        for (Map<String, Object> p : census) {
            @SuppressWarnings("unchecked")
            Map<String, Object> scores = (Map<String, Object>) p.getOrDefault("latestScores", Map.of());
            int composite = computePatientRisk(scores, deterioratingBeds.contains(p.get("bedLabel")),
                    Boolean.TRUE.equals(p.get("ventilated")));

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("patientName", p.get("patientName"));
            row.put("mrn", p.get("mrn"));
            row.put("bedLabel", p.get("bedLabel"));
            row.put("unitName", p.get("unitName"));
            row.put("losDays", p.get("losDays"));
            row.put("ventilated", p.get("ventilated"));
            row.put("latestScores", scores);
            row.put("compositeRisk", composite);
            row.put("riskTier", composite >= 70 ? "CRITICAL" : composite >= 40 ? "HIGH"
                    : composite >= 20 ? "MODERATE" : "LOW");
            row.put("deteriorating", deterioratingBeds.contains(p.get("bedLabel")));
            matrix.add(row);
        }
        matrix.sort((a, b) -> Integer.compare(
                toInt(b.get("compositeRisk")), toInt(a.get("compositeRisk"))));
        return matrix;
    }

    private int computePatientRisk(Map<String, Object> scores, boolean deteriorating, boolean ventilated) {
        int risk = 0;
        if (deteriorating) risk += 35;
        if (ventilated) risk += 15;
        if (scores.containsKey("NEWS2")) {
            double v = toDouble(((Map<?, ?>) scores.get("NEWS2")).get("totalScore"));
            risk += Math.min(30, (int) (v * 3));
        }
        if (scores.containsKey("SOFA")) {
            double v = toDouble(((Map<?, ?>) scores.get("SOFA")).get("totalScore"));
            risk += Math.min(25, (int) (v * 2));
        }
        if (scores.containsKey("CAM_ICU")) {
            double v = toDouble(((Map<?, ?>) scores.get("CAM_ICU")).get("totalScore"));
            if (v >= 1) risk += 20;
        }
        return Math.min(100, risk);
    }

    private boolean isHighRiskScores(Map<String, Object> scores) {
        if (scores.containsKey("NEWS2")) {
            double v = toDouble(((Map<?, ?>) scores.get("NEWS2")).get("totalScore"));
            if (v >= 7) return true;
        }
        if (scores.containsKey("SOFA")) {
            double v = toDouble(((Map<?, ?>) scores.get("SOFA")).get("totalScore"));
            if (v >= 6) return true;
        }
        return false;
    }

    private List<Map<String, Object>> buildExecutiveKpis(Map<String, Object> totals,
                                                         Map<String, Object> scoring,
                                                         Map<String, Object> orders,
                                                         Map<String, Object> fluids,
                                                         Map<String, Object> labs,
                                                         Map<String, Object> alarms,
                                                         Map<String, Object> throughput,
                                                         Map<String, Object> devices,
                                                         Map<String, Object> discharges) {
        List<Map<String, Object>> kpis = new ArrayList<>();
        kpis.add(kpi("occupancy", "Bed Occupancy", totals.get("occupancyPct"), "%",
                statusFromOccupancy(toInt(totals.get("occupancyPct")))));
        kpis.add(kpi("census", "Active Census", throughput.get("activeCensus"), "patients", "neutral"));
        kpis.add(kpi("discharges", "Discharges (24h)", discharges.get("discharges24h"), "patients", "neutral"));
        kpis.add(kpi("alarms", "Active Alarms", alarms.get("active"), "live", alarmStatus(alarms)));
        kpis.add(kpi("high-risk", "High-Risk Patients", scoring.get("highRiskPatients"), "patients", "critical"));
        kpis.add(kpi("vent", "Ventilated", totals.get("ventilatedCount"), "patients", "warning"));
        kpis.add(kpi("avg-los", "Avg LOS", throughput.get("avgLosDays"), "days", "neutral"));
        kpis.add(kpi("orders", "Active Orders", orders.get("activeCount"), "orders", "neutral"));
        kpis.add(kpi("stat", "STAT Orders", orders.get("statCount"), "urgent", statStatus(orders)));
        kpis.add(kpi("fluids", "Running Infusions", fluids.get("runningInfusions"), "lines", "neutral"));
        kpis.add(kpi("labs", "Labs (24h)", labs.get("results24h"), "results", "neutral"));
        kpis.add(kpi("abnormal", "Abnormal Labs", labs.get("abnormal24h"), "flags", labAbnormalStatus(labs)));
        kpis.add(kpi("score-cov", "Score Coverage", scoring.get("coveragePct"), "%", "good"));
        @SuppressWarnings("unchecked")
        Map<String, Object> vents = (Map<String, Object>) devices.get("ventilators");
        kpis.add(kpi("vent-util", "Vent Utilization", vents.get("utilizationPct"), "%", "neutral"));
        return kpis;
    }

    private Map<String, Object> kpi(String id, String label, Object value, String unit, String status) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("label", label);
        m.put("value", value);
        m.put("unit", unit);
        m.put("status", status);
        return m;
    }

    private String statusFromOccupancy(int pct) {
        if (pct >= 90) return "critical";
        if (pct >= 75) return "warning";
        return "good";
    }

    private String alarmStatus(Map<String, Object> alarms) {
        return toInt(alarms.get("critical")) > 0 ? "critical" : toInt(alarms.get("active")) > 0 ? "warning" : "good";
    }

    private String statStatus(Map<String, Object> orders) {
        return toInt(orders.get("statCount")) > 0 ? "warning" : "good";
    }

    private String labAbnormalStatus(Map<String, Object> labs) {
        return toInt(labs.get("abnormal24h")) > 0 ? "warning" : "good";
    }

    private List<String> buildInsights(Map<String, Object> totals, Map<String, Object> scoring,
                                       Map<String, Object> orders, Map<String, Object> alarms,
                                       Map<String, Object> throughput, Map<String, Object> devices,
                                       Map<String, Object> discharges) {
        List<String> insights = new ArrayList<>();
        int occupancy = toInt(totals.get("occupancyPct"));
        int highRisk = toInt(scoring.get("highRiskPatients"));
        int activeAlarms = toInt(alarms.get("active"));
        int stat = toInt(orders.get("statCount"));
        int coverage = toInt(scoring.get("coveragePct"));

        if (occupancy >= 90) {
            insights.add("Center at " + occupancy + "% capacity — activate surge bed management and cross-unit staffing review.");
        } else if (occupancy >= 75) {
            insights.add("Occupancy elevated at " + occupancy + "% — monitor admission pipeline and expected discharges.");
        } else {
            insights.add("Occupancy at " + occupancy + "% — capacity available for incoming transfers.");
        }

        int discharges24h = toInt(discharges.get("discharges24h"));
        int discharges7d = toInt(discharges.get("discharges7d"));
        if (discharges24h > 0) {
            insights.add(discharges24h + " discharge(s) in the last 24 hours — verify discharge summaries and follow-up plans are complete.");
        } else if (discharges7d > 0) {
            insights.add(discharges7d + " discharge(s) in the last 7 days; avg LOS at discharge "
                    + discharges.get("avgLosAtDischargeDays") + " days.");
        }

        if (highRisk > 0) {
            insights.add(highRisk + " patient(s) exceed high-risk clinical thresholds (NEWS2 ≥7, SOFA ≥6, or APACHE II ≥15). Prioritize bedside review.");
        }

        if (activeAlarms > 0) {
            insights.add(activeAlarms + " live alarm(s) across the center — " + alarms.get("critical") + " critical. Command center should track acknowledgment latency.");
        }

        if (stat > 0) {
            insights.add(stat + " STAT order(s) pending execution — verify pharmacy and nursing workflow completion.");
        }

        if (coverage < 80 && toInt(throughput.get("activeCensus")) > 0) {
            insights.add("Clinical score coverage at " + coverage + "% — complete NEWS2/SOFA assessments for unscored patients.");
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> vents = (Map<String, Object>) devices.get("ventilators");
        int ventUtil = toInt(vents.get("utilizationPct"));
        if (ventUtil >= 80) {
            insights.add("Ventilator fleet at " + ventUtil + "% utilization — confirm backup device readiness.");
        }

        int cam = toInt(scoring.get("camPositiveCount"));
        if (cam > 0) {
            insights.add(cam + " CAM-ICU positive screen(s) — evaluate delirium bundles and sedation targets.");
        }

        if (insights.size() < 6) {
            insights.add("Avg ICU length of stay: " + throughput.get("avgLosDays") + " days across " + throughput.get("activeCensus") + " active patients.");
        }
        return insights;
    }

    private List<Map<String, Object>> buildHourlyOccupancyTrend(List<Map<String, Object>> census,
                                                                Instant since, Instant now) {
        int[] buckets = new int[24];
        int current = census.size();
        for (int i = 0; i < 24; i++) buckets[i] = current;

        for (Map<String, Object> row : census) {
            Instant admitted = Instant.parse(row.get("admittedAt").toString());
            if (admitted.isAfter(since)) {
                long hoursAgo = ChronoUnit.HOURS.between(admitted, now);
                if (hoursAgo >= 0 && hoursAgo < 24) {
                    for (int i = 0; i <= 23 - (int) hoursAgo; i++) {
                        buckets[i]++;
                    }
                }
            }
        }
        return hourlyList(buckets);
    }

    private List<Map<String, Object>> hourlyList(int[] buckets) {
        List<Map<String, Object>> list = new ArrayList<>();
        for (int i = 0; i < buckets.length; i++) {
            Map<String, Object> point = new LinkedHashMap<>();
            point.put("hour", String.format("%02d:00", i));
            point.put("value", buckets[i]);
            list.add(point);
        }
        return list;
    }

    private boolean visitInCenter(UUID visitId, String centerId) {
        if (visitId == null || centerId == null) return false;
        return assignmentRepository.findFirstByVisitIdOrderByAssignedAtDesc(visitId)
                .flatMap(a -> bedRepository.findById(a.getBedId()))
                .map(b -> centerId.equalsIgnoreCase(b.getCenterId()))
                .orElse(false);
    }

    private List<Map<String, Object>> toSortedList(Map<String, Integer> map, int limit) {
        return map.entrySet().stream()
                .sorted((a, b) -> Integer.compare(b.getValue(), a.getValue()))
                .limit(limit)
                .map(e -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("label", e.getKey());
                    m.put("value", e.getValue());
                    return m;
                })
                .toList();
    }

    private int toInt(Object v) {
        if (v == null) return 0;
        if (v instanceof Number n) return n.intValue();
        try { return (int) Math.round(Double.parseDouble(v.toString())); }
        catch (Exception e) { return 0; }
    }

    private double toDouble(Object v) {
        if (v == null) return 0;
        if (v instanceof BigDecimal bd) return bd.doubleValue();
        if (v instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(v.toString()); }
        catch (Exception e) { return 0; }
    }

    private double round1(double v) {
        return BigDecimal.valueOf(v).setScale(1, RoundingMode.HALF_UP).doubleValue();
    }

    private double round0(double v) {
        return BigDecimal.valueOf(v).setScale(0, RoundingMode.HALF_UP).doubleValue();
    }
}
