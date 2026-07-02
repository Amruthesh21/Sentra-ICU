package com.rtwo.alarmengine.hub.service;

import com.rtwo.alarmengine.hub.entity.*;
import com.rtwo.alarmengine.hub.repo.*;
import com.rtwo.alarmengine.service.VitalsHistoryService;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class HubReportService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter DATE_ISO = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final DateTimeFormatter FILE_DATE = DateTimeFormatter.ofPattern("yyyyMMdd");

  private static final List<String> DEFAULT_VITAL_PARAMS = List.of(
            "HeartRate", "SpO2", "Resp.Rate", "Temp1",
            "PEEP", "MV", "Peak", "VT", "Inf Rate", "Inf Vol", "Bolus Vol", "Bolus Rate"
    );

    private static final String[] HOUR_LABELS = {
            "00:00", "01:00", "02:00", "03:00", "04:00", "05:00", "06:00", "07:00",
            "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00",
            "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00"
    };

    private final HubPatientVisitRepository visitRepository;
    private final HubPatientRepository patientRepository;
    private final HubBedAssignmentRepository assignmentRepository;
    private final HubBedRepository bedRepository;
    private final HubUnitRepository unitRepository;
    private final HubClinicalNoteRepository noteRepository;
    private final HubOrderRepository orderRepository;
    private final HubLabResultRepository labRepository;
    private final HubImagingStudyRepository imagingRepository;
    private final HubFluidEntryRepository fluidRepository;
    private final VitalsHistoryService vitalsHistoryService;
    private final HubClinicalService clinicalService;

    public HubReportService(HubPatientVisitRepository visitRepository,
                            HubPatientRepository patientRepository,
                            HubBedAssignmentRepository assignmentRepository,
                            HubBedRepository bedRepository,
                            HubUnitRepository unitRepository,
                            HubClinicalNoteRepository noteRepository,
                            HubOrderRepository orderRepository,
                            HubLabResultRepository labRepository,
                            HubImagingStudyRepository imagingRepository,
                            HubFluidEntryRepository fluidRepository,
                            VitalsHistoryService vitalsHistoryService,
                            HubClinicalService clinicalService) {
        this.visitRepository = visitRepository;
        this.patientRepository = patientRepository;
        this.assignmentRepository = assignmentRepository;
        this.bedRepository = bedRepository;
        this.unitRepository = unitRepository;
        this.noteRepository = noteRepository;
        this.orderRepository = orderRepository;
        this.labRepository = labRepository;
        this.imagingRepository = imagingRepository;
        this.fluidRepository = fluidRepository;
        this.vitalsHistoryService = vitalsHistoryService;
        this.clinicalService = clinicalService;
    }

    public Map<String, Object> generateReport(Map<String, Object> request) {
        UUID visitId = UUID.fromString(request.get("visitId").toString());
        String reportType = stringVal(request.get("reportType"), "CLINICAL_SUMMARY");

        HubPatientVisitEntity visit = visitRepository.findById(visitId)
                .orElseThrow(() -> new IllegalArgumentException("Visit not found"));
        HubPatientEntity patient = patientRepository.findById(visit.getPatientId())
                .orElseThrow(() -> new IllegalArgumentException("Patient not found"));

        String bedId = resolveBedId(visitId);
        HubBedEntity bed = resolveBed(visitId);

        LocalDate admitDate = visit.getAdmittedAt().atZone(IST).toLocalDate();
        LocalDate endDate = visit.getDischargedAt() != null
                ? visit.getDischargedAt().atZone(IST).toLocalDate()
                : LocalDate.now(IST);

        LocalDate fromDate = parseDate(request.get("fromDate"), admitDate);
        LocalDate toDate = parseDate(request.get("toDate"), endDate);

        if ("COMPLETE_PATIENT".equalsIgnoreCase(reportType)) {
            fromDate = admitDate;
            toDate = endDate;
        }

        if (fromDate.isBefore(admitDate)) fromDate = admitDate;
        if (toDate.isAfter(endDate)) toDate = endDate;
        if (fromDate.isAfter(toDate)) {
            throw new IllegalArgumentException("Invalid date range");
        }

        @SuppressWarnings("unchecked")
        List<String> vitalsParams = request.containsKey("vitalsParams")
                ? ((List<?>) request.get("vitalsParams")).stream().map(Object::toString).toList()
                : DEFAULT_VITAL_PARAMS;

        List<HubClinicalNoteEntity> allNotes = noteRepository.findByVisitIdOrderByUpdatedAtDesc(visitId);
        List<HubOrderEntity> allOrders = orderRepository.findByVisitIdOrderByOrderedAtDesc(visitId);
        List<HubLabResultEntity> allLabs = labRepository.findByVisitIdOrderByResultedAtDesc(visitId);
        List<HubImagingStudyEntity> allImaging = imagingRepository.findByVisitIdOrderByStudyAtDesc(visitId);

        Instant rangeFrom = fromDate.atStartOfDay(IST).toInstant();
        Instant rangeTo = toDate.plusDays(1).atStartOfDay(IST).toInstant().minusMillis(1);

        List<Map<String, Object>> fluidEntries = fluidRepository
                .findByVisitIdAndRecordedAtBetweenOrderByRecordedAtAsc(visitId, rangeFrom, rangeTo)
                .stream().map(this::fluidToMap).toList();

        List<Map<String, Object>> dailyReports = new ArrayList<>();
        List<String> uniqueVitalsParams = dedupeVitalsParams(vitalsParams);
        LocalDate todayIst = LocalDate.now(IST);

        for (LocalDate day = fromDate; !day.isAfter(toDate); day = day.plusDays(1)) {
            Instant dayStart = day.atStartOfDay(IST).toInstant();
            Instant dayEnd = day.plusDays(1).atStartOfDay(IST).toInstant().minusMillis(1);

            List<Map<String, Object>> daySeries = List.of();
            if (bedId != null) {
                boolean includeBuffer = day.equals(todayIst);
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> series = (List<Map<String, Object>>) vitalsHistoryService
                        .getTrendHistory(bedId, dayStart, dayEnd, includeBuffer)
                        .getOrDefault("series", List.of());
                daySeries = series;
            }

            dailyReports.add(buildDayReport(
                    day, visit, patient, bed, bedId, daySeries, uniqueVitalsParams,
                    allNotes, allOrders, allLabs, allImaging, fluidEntries));
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> patientSummary = bed != null
                ? (Map<String, Object>) clinicalService.getContext(bedId != null ? bedId : "ICU-1-" + bed.getBedLabel())
                .getOrDefault("patientSummary", Map.of())
                : buildMinimalSummary(patient, visit, bed);

        Map<String, Object> report = new LinkedHashMap<>();
        report.put("reportType", reportType);
        report.put("generatedAt", Instant.now().toString());
        report.put("timezone", "Asia/Kolkata");
        report.put("visitId", visitId.toString());
        report.put("bedId", bedId);
        report.put("fromDate", fromDate.format(DATE_ISO));
        report.put("toDate", toDate.format(DATE_ISO));
        report.put("patientSummary", patientSummary);
        report.put("patient", Map.of(
                "fullName", patient.getFullName(),
                "mrn", patient.getMrn(),
                "crn", patient.getMrn()
        ));
        report.put("admitDate", admitDate.format(DATE_FMT));
        report.put("dischargeDate", visit.getDischargedAt() != null
                ? visit.getDischargedAt().atZone(IST).format(DATE_FMT) : null);
        report.put("losDays", ChronoUnit.DAYS.between(admitDate, toDate) + 1);
        report.put("fileName", buildFileName(patient, toDate));
        report.put("dailyReports", dailyReports);
        report.put("vitalsParams", vitalsParams);
        return report;
    }

    public List<Map<String, Object>> listReportablePatients(String unitId) {
        return listPatientsForCohort(unitId, false);
    }

    public List<Map<String, Object>> listDischargedPatients(String unitId) {
        return listPatientsForCohort(unitId, true);
    }

    private List<Map<String, Object>> listPatientsForCohort(String unitId, boolean discharged) {
        if (discharged) {
            List<Map<String, Object>> patients = new ArrayList<>();
            for (HubPatientVisitEntity visit : visitRepository.findByStatusOrderByDischargedAtDesc("DISCHARGED")) {
                HubPatientEntity patient = patientRepository.findById(visit.getPatientId()).orElse(null);
                if (patient == null) continue;
                HubBedEntity bed = resolveBed(visit.getId());
                if (bed == null) continue;
                if (unitId != null && !unitId.isBlank() && bed.getUnitId() != null
                        && !bed.getUnitId().toString().equals(unitId)) {
                    continue;
                }
                patients.add(toPatientRow(visit, patient, bed));
            }
            return patients;
        }

        List<Map<String, Object>> patients = new ArrayList<>();
        List<HubBedEntity> beds = bedRepository.findByCenterIdAndActiveTrueOrderByBedLabel("RTWO");
        for (HubBedEntity bed : beds) {
            if (unitId != null && !unitId.isBlank() && bed.getUnitId() != null
                    && !bed.getUnitId().toString().equals(unitId)) {
                continue;
            }
            Optional<HubBedAssignmentEntity> assignment =
                    assignmentRepository.findByBedIdAndActiveTrue(bed.getId());
            if (assignment.isEmpty()) continue;
            HubPatientVisitEntity visit = visitRepository.findById(assignment.get().getVisitId()).orElse(null);
            if (visit == null) continue;
            HubPatientEntity patient = patientRepository.findById(visit.getPatientId()).orElse(null);
            if (patient == null) continue;
            patients.add(toPatientRow(visit, patient, bed));
        }
        return patients;
    }

    private Map<String, Object> toPatientRow(HubPatientVisitEntity visit,
                                             HubPatientEntity patient,
                                             HubBedEntity bed) {
        String unitName = "";
        if (bed.getUnitId() != null) {
            unitName = unitRepository.findById(bed.getUnitId()).map(HubUnitEntity::getName).orElse("");
        }
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("visitId", visit.getId().toString());
        row.put("patientId", patient.getId().toString());
        row.put("patientName", patient.getFullName());
        row.put("mrn", patient.getMrn());
        row.put("bedLabel", bed.getBedLabel());
        row.put("bedId", "ICU-1-" + bed.getBedLabel());
        row.put("unitId", bed.getUnitId() != null ? bed.getUnitId().toString() : null);
        row.put("unitName", unitName);
        row.put("admittedAt", visit.getAdmittedAt().toString());
        row.put("dischargedAt", visit.getDischargedAt() != null ? visit.getDischargedAt().toString() : null);
        row.put("dischargeReason", visit.getDischargeReason());
        row.put("dischargeDestination", visit.getDischargeDestination());
        row.put("followUpPlan", visit.getFollowUpPlan());
        row.put("status", visit.getStatus());
        row.put("primaryDiagnosis", visit.getPrimaryDiagnosis());
        return row;
    }

    private Map<String, Object> buildDayReport(
            LocalDate day,
            HubPatientVisitEntity visit,
            HubPatientEntity patient,
            HubBedEntity bed,
            String bedId,
            List<Map<String, Object>> vitalsSeries,
            List<String> vitalsParams,
            List<HubClinicalNoteEntity> allNotes,
            List<HubOrderEntity> allOrders,
            List<HubLabResultEntity> allLabs,
            List<HubImagingStudyEntity> allImaging,
            List<Map<String, Object>> fluidEntries) {

        Instant dayStart = day.atStartOfDay(IST).toInstant();
        Instant dayEnd = day.plusDays(1).atStartOfDay(IST).toInstant().minusMillis(1);

        Map<String, Object> dayReport = new LinkedHashMap<>();
        dayReport.put("date", day.format(DATE_ISO));
        dayReport.put("dateDisplay", day.format(DATE_FMT));
        dayReport.put("dayNumber", ChronoUnit.DAYS.between(
                visit.getAdmittedAt().atZone(IST).toLocalDate(), day) + 1);

        dayReport.put("overview", buildOverview(vitalsSeries, vitalsParams, dayStart, dayEnd));
        dayReport.put("vitalsHourly", buildHourlyVitals(vitalsSeries, vitalsParams, dayStart, dayEnd));
        dayReport.put("fluids", buildFluidsSection(fluidEntries, vitalsSeries, dayStart, dayEnd));
        dayReport.put("notes", filterNotes(allNotes, dayStart, dayEnd));
        dayReport.put("orders", filterOrdersForDay(allOrders, dayStart, dayEnd));
        dayReport.put("labs", filterLabs(allLabs, dayStart, dayEnd));
        dayReport.put("imaging", filterImaging(allImaging, dayStart, dayEnd));
        dayReport.put("waveforms", buildWaveformSeries(vitalsSeries, dayStart, dayEnd));
        dayReport.put("waveformSummary", buildWaveformSummary(dayReport.get("overview")));
        return dayReport;
    }

    private Map<String, Object> buildOverview(List<Map<String, Object>> series,
                                              List<String> params,
                                              Instant from, Instant to) {
        Map<String, Object> overview = new LinkedHashMap<>();
        for (String param : params) {
            Double last = lastValueInRange(series, param, from, to);
            if (last != null) {
                overview.put(normalizeParam(param), round(last));
            }
        }
        return overview;
    }

    private List<Map<String, Object>> buildHourlyVitals(List<Map<String, Object>> series,
                                                        List<String> params,
                                                        Instant dayStart, Instant dayEnd) {
        List<Map<String, Object>> rows = new ArrayList<>();
        Set<String> added = new LinkedHashSet<>();
        for (String param : params) {
            String norm = normalizeParam(param);
            if (!added.add(norm)) continue;

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("param", displayParam(norm));
            List<Object> hours = new ArrayList<>();
            double dayTotal = 0;
            int dayCount = 0;
            for (int h = 0; h < 24; h++) {
                Instant hStart = dayStart.plus(h, ChronoUnit.HOURS);
                Instant hEnd = hStart.plus(1, ChronoUnit.HOURS).minusMillis(1);
                Double val = lastValueInRange(series, param, hStart, hEnd);
                if (val == null) {
                    val = avgValueInRange(series, param, hStart, hEnd);
                }
                hours.add(val != null ? round(val) : null);
                if (val != null) {
                    dayTotal += val;
                    dayCount++;
                }
            }
            row.put("hours", hours);
            row.put("hourLabels", List.of(HOUR_LABELS));
            row.put("dayAvg", dayCount > 0 ? round(dayTotal / dayCount) : null);
            if (dayCount > 0) rows.add(row);
        }
        return rows;
    }

    private Map<String, Object> buildFluidsSection(List<Map<String, Object>> fluidEntries,
                                                   List<Map<String, Object>> vitalsSeries,
                                                   Instant dayStart, Instant dayEnd) {
        double totalIntake = 0;
        double totalOutput = 0;
        List<Map<String, Object>> intakeRows = new ArrayList<>();
        List<Map<String, Object>> outputRows = new ArrayList<>();

        for (Map<String, Object> entry : fluidEntries) {
            Instant ts = Instant.parse(entry.get("recordedAt").toString());
            if (ts.isBefore(dayStart) || ts.isAfter(dayEnd)) continue;
            double vol = toDouble(entry.get("volumeMl"));
            String type = entry.get("entryType").toString();
            Map<String, Object> row = new LinkedHashMap<>(entry);
            if ("OUTPUT".equalsIgnoreCase(type)) {
                outputRows.add(row);
                totalOutput += vol;
            } else {
                intakeRows.add(row);
                totalIntake += vol;
            }
        }

        Map<String, Object> infusionHourly = buildInfusionFromVitals(vitalsSeries, dayStart, dayEnd);
        if (infusionHourly != null) {
            intakeRows.add(0, infusionHourly);
            Object total = infusionHourly.get("dayTotal");
            if (total instanceof Number n) totalIntake += n.doubleValue();
        }

        Map<String, Object> fluids = new LinkedHashMap<>();
        fluids.put("totalIntakeMl", round(totalIntake));
        fluids.put("totalOutputMl", round(totalOutput));
        fluids.put("balance24hMl", round(totalIntake - totalOutput));
        fluids.put("intake", intakeRows);
        fluids.put("output", outputRows);
        return fluids;
    }

    private Map<String, Object> buildInfusionFromVitals(List<Map<String, Object>> series,
                                                         Instant dayStart, Instant dayEnd) {
        Double total = sumValuesInRange(series, "Inf Vol", dayStart, dayEnd);
        if (total == null) total = sumValuesInRange(series, "Inf Vol", dayStart, dayEnd);
        List<Object> hours = new ArrayList<>();
        double hourSum = 0;
        int count = 0;
        for (int h = 0; h < 24; h++) {
            Instant hStart = dayStart.plus(h, ChronoUnit.HOURS);
            Instant hEnd = hStart.plus(1, ChronoUnit.HOURS).minusMillis(1);
            Double v = lastValueInRange(series, "Inf Vol", hStart, hEnd);
            if (v == null) v = lastValueInRange(series, "Inf Rate", hStart, hEnd);
            hours.add(v != null ? round(v) : null);
            if (v != null) { hourSum += v; count++; }
        }
        if (count == 0 && total == null) return null;
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("fluidName", "Device Infusion (derived)");
        row.put("category", "Infusions");
        row.put("entryType", "INTAKE");
        row.put("hours", hours);
        row.put("dayTotal", count > 0 ? round(hourSum) : total);
        row.put("unit", "ml");
        return row;
    }

    private Map<String, Object> buildWaveformSummary(Object overviewObj) {
        Map<String, Object> summary = new LinkedHashMap<>();
        if (overviewObj instanceof Map<?, ?> overview) {
            if (overview.containsKey("HeartRate")) summary.put("heartRate", overview.get("HeartRate"));
            if (overview.containsKey("SpO2")) summary.put("spo2", overview.get("SpO2"));
            if (overview.containsKey("Resp.Rate")) summary.put("respRate", overview.get("Resp.Rate"));
        }
        return summary;
    }

    private Map<String, Object> buildWaveformSeries(List<Map<String, Object>> series,
                                                      Instant dayStart, Instant dayEnd) {
        Map<String, Object> waveforms = new LinkedHashMap<>();
        waveforms.put("heartRate", buildWaveformChannel(
                series, List.of("HeartRate", "Heart Rate", "Pulse"),
                "ECG / Heart Rate", "bpm", dayStart, dayEnd));
        waveforms.put("spo2", buildWaveformChannel(
                series, List.of("SpO2"), "Pleth / SpO₂", "%", dayStart, dayEnd));
        waveforms.put("respRate", buildWaveformChannel(
                series, List.of("Resp.Rate"), "Respiratory", "bpm", dayStart, dayEnd));
        return waveforms;
    }

    private Map<String, Object> buildWaveformChannel(List<Map<String, Object>> series,
                                                     List<String> paramNames,
                                                     String label,
                                                     String unit,
                                                     Instant dayStart,
                                                     Instant dayEnd) {
        List<Map<String, Object>> raw = collectPoints(series, paramNames, dayStart, dayEnd);
        List<Map<String, Object>> points = downsamplePoints(raw, 400);
        Map<String, Object> channel = new LinkedHashMap<>();
        channel.put("label", label);
        channel.put("unit", unit);
        channel.put("points", points);
        channel.put("fromDisplay", formatIst(dayStart));
        channel.put("toDisplay", formatIst(dayEnd));
        if (!points.isEmpty()) {
            channel.put("latestValue", points.get(points.size() - 1).get("value"));
            channel.put("latestAt", points.get(points.size() - 1).get("timestamp"));
        }
        return channel;
    }

    private List<Map<String, Object>> collectPoints(List<Map<String, Object>> series,
                                                    List<String> paramNames,
                                                    Instant from, Instant to) {
        List<Map<String, Object>> merged = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        for (String param : paramNames) {
            for (Map<String, Object> p : findPoints(series, param)) {
                Instant ts = Instant.parse(p.get("timestamp").toString());
                if (ts.isBefore(from) || ts.isAfter(to)) continue;
                String key = p.get("timestamp").toString();
                if (seen.add(key)) {
                    Map<String, Object> pt = new LinkedHashMap<>();
                    pt.put("timestamp", p.get("timestamp"));
                    pt.put("value", round(toDouble(p.get("value"))));
                    merged.add(pt);
                }
            }
        }
        merged.sort(Comparator.comparing(m -> Instant.parse(m.get("timestamp").toString())));
        return merged;
    }

    private List<Map<String, Object>> downsamplePoints(List<Map<String, Object>> points, int maxPoints) {
        if (points.size() <= maxPoints) return points;
        List<Map<String, Object>> result = new ArrayList<>();
        double step = (double) points.size() / maxPoints;
        for (int i = 0; i < maxPoints; i++) {
            result.add(points.get((int) (i * step)));
        }
        if (!points.get(points.size() - 1).equals(result.get(result.size() - 1))) {
            result.add(points.get(points.size() - 1));
        }
        return result;
    }

    private String formatIst(Instant instant) {
        return instant.atZone(IST).format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"));
    }

    private List<String> dedupeVitalsParams(List<String> params) {
        List<String> result = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        for (String param : params) {
            String norm = normalizeParam(param);
            if (seen.add(norm)) {
                result.add(paramForLookup(norm));
            }
        }
        return result;
    }

    private String paramForLookup(String norm) {
        if ("HeartRate".equals(norm)) return "HeartRate";
        return norm;
    }

    private String displayParam(String norm) {
        if ("HeartRate".equals(norm)) return "Heart Rate";
        return norm;
    }

    private List<Map<String, Object>> filterNotes(List<HubClinicalNoteEntity> notes,
                                                   Instant from, Instant to) {
        return notes.stream()
                .filter(n -> inRange(n.getCreatedAt(), from, to)
                        || inRange(n.getUpdatedAt(), from, to))
                .map(n -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("noteType", n.getNoteType());
                    m.put("title", n.getTitle() != null ? n.getTitle() : "");
                    m.put("content", n.getContent());
                    m.put("authorName", n.getAuthorName());
                    m.put("status", n.getStatus());
                    m.put("createdAt", n.getCreatedAt().toString());
                    m.put("updatedAt", n.getUpdatedAt().toString());
                    return m;
                }).toList();
    }

    private List<Map<String, Object>> filterOrdersForDay(List<HubOrderEntity> orders,
                                                          Instant dayStart, Instant dayEnd) {
        return orders.stream()
                .filter(o -> orderRelevantOnDay(o, dayStart, dayEnd))
                .sorted(Comparator.comparing(HubOrderEntity::getOrderedAt))
                .map(this::orderToMap)
                .toList();
    }

    private boolean orderRelevantOnDay(HubOrderEntity o, Instant dayStart, Instant dayEnd) {
        Instant ordered = o.getOrderedAt();
        Instant dc = o.getDiscontinuedAt();
        if (inRange(ordered, dayStart, dayEnd)) return true;
        if (dc != null && inRange(dc, dayStart, dayEnd)) return true;
        return !ordered.isAfter(dayEnd) && (dc == null || !dc.isBefore(dayStart));
    }

    private Map<String, Object> orderToMap(HubOrderEntity o) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("orderId", o.getId().toString());
        m.put("orderType", o.getOrderType());
        m.put("orderText", o.getOrderText());
        m.put("drugName", o.getDrugName() != null ? o.getDrugName() : "");
        m.put("dose", o.getDose() != null ? o.getDose() : "");
        m.put("route", o.getRoute() != null ? o.getRoute() : "");
        m.put("frequency", o.getFrequency() != null ? o.getFrequency() : "");
        m.put("duration", o.getDuration() != null ? o.getDuration() : "");
        m.put("status", o.getStatus());
        m.put("orderedBy", o.getOrderedBy());
        m.put("orderedAt", o.getOrderedAt().toString());
        m.put("priority", o.getPriority());
        m.put("discontinuedAt", o.getDiscontinuedAt() != null ? o.getDiscontinuedAt().toString() : null);
        m.put("discontinueReason", o.getDiscontinueReason() != null ? o.getDiscontinueReason() : "");
        m.put("notes", o.getNotes() != null ? o.getNotes() : "");
        return m;
    }

    private List<Map<String, Object>> filterLabs(List<HubLabResultEntity> labs,
                                                  Instant from, Instant to) {
        return labs.stream()
                .filter(l -> inRange(l.getResultedAt(), from, to))
                .map(l -> Map.<String, Object>of(
                        "testName", l.getTestName(),
                        "value", l.getValue() != null ? l.getValue() : "",
                        "unit", l.getUnit() != null ? l.getUnit() : "",
                        "flag", l.getFlag() != null ? l.getFlag() : "",
                        "referenceRange", l.getReferenceRange() != null ? l.getReferenceRange() : "",
                        "resultedAt", l.getResultedAt().toString()
                )).toList();
    }

    private List<Map<String, Object>> filterImaging(List<HubImagingStudyEntity> imaging,
                                                   Instant from, Instant to) {
        return imaging.stream()
                .filter(i -> inRange(i.getStudyAt(), from, to))
                .map(i -> Map.<String, Object>of(
                        "modality", i.getModality() != null ? i.getModality() : "",
                        "studyName", i.getStudyName(),
                        "findings", i.getFindings() != null ? i.getFindings() : "",
                        "impression", i.getImpression() != null ? i.getImpression() : "",
                        "studyAt", i.getStudyAt().toString()
                )).toList();
    }

    private boolean inRange(Instant ts, Instant from, Instant to) {
        return ts != null && !ts.isBefore(from) && !ts.isAfter(to);
    }

    private Double lastValueInRange(List<Map<String, Object>> series, String param,
                                    Instant from, Instant to) {
        List<Map<String, Object>> points = findPoints(series, param);
        Double last = null;
        for (Map<String, Object> p : points) {
            Instant ts = Instant.parse(p.get("timestamp").toString());
            if (!ts.isBefore(from) && !ts.isAfter(to)) {
                last = toDouble(p.get("value"));
            }
        }
        return last;
    }

    private Double avgValueInRange(List<Map<String, Object>> series, String param,
                                   Instant from, Instant to) {
        List<Map<String, Object>> points = findPoints(series, param);
        double sum = 0;
        int count = 0;
        for (Map<String, Object> p : points) {
            Instant ts = Instant.parse(p.get("timestamp").toString());
            if (!ts.isBefore(from) && !ts.isAfter(to)) {
                sum += toDouble(p.get("value"));
                count++;
            }
        }
        return count > 0 ? sum / count : null;
    }

    private Double sumValuesInRange(List<Map<String, Object>> series, String param,
                                    Instant from, Instant to) {
        List<Map<String, Object>> points = findPoints(series, param);
        double sum = 0;
        int count = 0;
        for (Map<String, Object> p : points) {
            Instant ts = Instant.parse(p.get("timestamp").toString());
            if (!ts.isBefore(from) && !ts.isAfter(to)) {
                sum += toDouble(p.get("value"));
                count++;
            }
        }
        return count > 0 ? sum : null;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> findPoints(List<Map<String, Object>> series, String param) {
        String norm = normalizeParam(param);
        for (Map<String, Object> s : series) {
            String name = s.get("paramName").toString();
            if (normalizeParam(name).equals(norm) || name.equals(param)) {
                return (List<Map<String, Object>>) s.get("points");
            }
        }
        if ("HeartRate".equals(norm)) {
            for (String alias : List.of("Pulse", "Heart Rate")) {
                for (Map<String, Object> s : series) {
                    if (alias.equals(s.get("paramName").toString())) {
                        return (List<Map<String, Object>>) s.get("points");
                    }
                }
            }
        }
        return List.of();
    }

    private String normalizeParam(String param) {
        if ("Heart Rate".equals(param) || "Pulse".equals(param)) return "HeartRate";
        return param;
    }

    private double toDouble(Object v) {
        if (v == null) return 0;
        if (v instanceof Number n) return n.doubleValue();
        try {
            return Double.parseDouble(v.toString());
        } catch (Exception e) {
            return 0;
        }
    }

    private double round(double v) {
        return BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }

    private String resolveBedId(UUID visitId) {
        return assignmentRepository.findByVisitIdAndActiveTrue(visitId)
                .or(() -> assignmentRepository.findFirstByVisitIdOrderByAssignedAtDesc(visitId))
                .flatMap(a -> bedRepository.findById(a.getBedId()))
                .map(b -> "ICU-1-" + b.getBedLabel())
                .orElse(null);
    }

    private HubBedEntity resolveBed(UUID visitId) {
        return assignmentRepository.findByVisitIdAndActiveTrue(visitId)
                .or(() -> assignmentRepository.findFirstByVisitIdOrderByAssignedAtDesc(visitId))
                .flatMap(a -> bedRepository.findById(a.getBedId()))
                .orElse(null);
    }

    private Map<String, Object> buildMinimalSummary(HubPatientEntity patient,
                                                    HubPatientVisitEntity visit,
                                                    HubBedEntity bed) {
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("patientName", patient.getFullName());
        s.put("mrn", patient.getMrn());
        if (bed != null) s.put("bedLabel", bed.getBedLabel());
        s.put("admittedAt", visit.getAdmittedAt().toString());
        return s;
    }

    private Map<String, Object> fluidToMap(HubFluidEntryEntity e) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("entryId", e.getId().toString());
        m.put("entryType", e.getEntryType());
        m.put("category", e.getCategory());
        m.put("fluidName", e.getFluidName());
        m.put("volumeMl", HubFluidService.effectiveVolumeMl(e));
        m.put("recordedAt", e.getRecordedAt().toString());
        m.put("intakeMode", e.getIntakeMode());
        m.put("rateMlPerHr", e.getRateMlPerHr());
        if (e.getStartedAt() != null) m.put("startedAt", e.getStartedAt().toString());
        m.put("runningStatus", e.getRunningStatus());
        return m;
    }

    private String buildFileName(HubPatientEntity patient, LocalDate date) {
        String name = patient.getFullName().replaceAll("[^a-zA-Z0-9]", "");
        return name + "_" + patient.getMrn() + "_" + date.format(FILE_DATE) + "_ICUPatientReport";
    }

    private LocalDate parseDate(Object value, LocalDate fallback) {
        if (value == null || value.toString().isBlank()) return fallback;
        try {
            return LocalDate.parse(value.toString());
        } catch (Exception e) {
            return fallback;
        }
    }

    private String stringVal(Object value, String fallback) {
        if (value == null || value.toString().isBlank()) return fallback;
        return value.toString().trim();
    }
}
