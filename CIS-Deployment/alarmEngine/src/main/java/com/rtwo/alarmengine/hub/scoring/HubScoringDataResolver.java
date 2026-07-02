package com.rtwo.alarmengine.hub.scoring;

import com.rtwo.alarmengine.hub.entity.*;
import com.rtwo.alarmengine.hub.repo.*;
import com.rtwo.alarmengine.service.VitalsHistoryService;
import com.rtwo.alarmengine.service.VitalsReadService;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.time.Period;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Component
public class HubScoringDataResolver {

    private static final Set<String> BP_KEYS = Set.of(
            "Systolic", "SystolicBP", "SBP", "NIBP Systolic", "NIBP_Sys", "BP Sys", "BP_Sys", "BP"
    );
    private static final Set<String> MAP_KEYS = Set.of("MAP", "Mean", "NIBP Mean", "NIBP_Mean");
    private static final Set<String> HR_KEYS = Set.of("HeartRate", "Heart Rate", "Pulse", "HR");
    private static final Set<String> RR_KEYS = Set.of("Resp.Rate", "Resp Rate", "RespRate", "RR");
    private static final Set<String> SPO2_KEYS = Set.of("SpO2", "SpO₂", "SPO2");
    private static final Set<String> TEMP_KEYS = Set.of("Temp1", "Temp2", "Temp", "Temperature");
    private static final Set<String> FIO2_KEYS = Set.of("FiO2", "FIO2", "O2Perc");

    private final HubPatientVisitRepository visitRepository;
    private final HubPatientRepository patientRepository;
    private final HubBedAssignmentRepository assignmentRepository;
    private final HubBedRepository bedRepository;
    private final HubLabResultRepository labRepository;
    private final VitalsHistoryService vitalsHistoryService;
    private final VitalsReadService vitalsReadService;

    public HubScoringDataResolver(HubPatientVisitRepository visitRepository,
                                  HubPatientRepository patientRepository,
                                  HubBedAssignmentRepository assignmentRepository,
                                  HubBedRepository bedRepository,
                                  HubLabResultRepository labRepository,
                                  VitalsHistoryService vitalsHistoryService,
                                  VitalsReadService vitalsReadService) {
        this.visitRepository = visitRepository;
        this.patientRepository = patientRepository;
        this.assignmentRepository = assignmentRepository;
        this.bedRepository = bedRepository;
        this.labRepository = labRepository;
        this.vitalsHistoryService = vitalsHistoryService;
        this.vitalsReadService = vitalsReadService;
    }

    public Map<String, Object> resolveAutoFill(UUID visitId, String scoreType) {
        HubPatientVisitEntity visit = visitRepository.findById(visitId)
                .orElseThrow(() -> new IllegalArgumentException("Visit not found"));
        HubPatientEntity patient = patientRepository.findById(visit.getPatientId())
                .orElseThrow(() -> new IllegalArgumentException("Patient not found"));

        String bedId = resolveBedId(visitId);
        Instant admittedAt = visit.getAdmittedAt();
        Instant windowEnd = admittedAt.plus(24, ChronoUnit.HOURS);
        Instant now = Instant.now();
        boolean apacheWindow = now.isBefore(windowEnd);

        Map<String, Double> latestVitals = bedId != null ? readLatestVitalsMap(bedId) : Map.of();
        Map<String, WorstVital> worst24h = bedId != null && apacheWindow
                ? worstVitalsInWindow(bedId, admittedAt, now.isBefore(windowEnd) ? now : windowEnd)
                : Map.of();
        Map<String, LabValue> labs = indexLabs(labRepository.findByVisitIdOrderByResultedAtDesc(visitId));

        Map<String, Object> fields = new LinkedHashMap<>();
        Map<String, String> sources = new LinkedHashMap<>();

        Integer age = calcAge(patient.getDateOfBirth());
        if (age != null) put(fields, sources, "age", age, "patient");

        String score = HubScoringCalculator.normalizeType(scoreType);

        putVital(fields, sources, "respRate", pickVital(latestVitals, worst24h, RR_KEYS, score), "vitals");
        putVital(fields, sources, "spo2", pickVital(latestVitals, worst24h, SPO2_KEYS, score), "vitals");
        putVital(fields, sources, "temperature", pickVital(latestVitals, worst24h, TEMP_KEYS, score), "vitals");
        putVital(fields, sources, "pulse", pickVital(latestVitals, worst24h, HR_KEYS, score), "vitals");
        putVital(fields, sources, "heartRate", pickVital(latestVitals, worst24h, HR_KEYS, score), "vitals");
        putVital(fields, sources, "systolicBp", pickVital(latestVitals, worst24h, BP_KEYS, score), "vitals");
        putVital(fields, sources, "map", pickVital(latestVitals, worst24h, MAP_KEYS, score), "vitals");
        putVital(fields, sources, "fio2", pickVital(latestVitals, worst24h, FIO2_KEYS, score), "vitals");

        putLab(fields, sources, "sodium", labs, "Sodium", "mmol/L");
        putLab(fields, sources, "potassium", labs, "Potassium", "mmol/L");
        putLab(fields, sources, "creatinine", labs, "Creatinine", "mg/dL");
        putLab(fields, sources, "wbc", labs, "WBC", "10^3/uL");
        putLab(fields, sources, "platelets", labs, "Platelets", "10^3/uL");
        putLab(fields, sources, "bilirubin", labs, "Bilirubin", "mg/dL");
        putLab(fields, sources, "ph", labs, "pH", "");
        putLab(fields, sources, "pao2", labs, "PaO2", "mmHg");
        putLab(fields, sources, "hematocrit", labs, "Hematocrit", "%");

        if (!fields.containsKey("hematocrit") || fields.get("hematocrit") == null) {
            LabValue hb = labs.get("hb");
            if (hb != null) {
                double hct = hb.value * 3.0;
                put(fields, sources, "hematocrit", Math.round(hct * 10) / 10.0, "lab-derived");
            }
        }

        Double pao2 = num(fields.get("pao2"));
        Double fio2 = num(fields.get("fio2"));
        if (pao2 != null && fio2 != null && fio2 > 0) {
            double ratio = pao2 / (fio2 / 100.0);
            put(fields, sources, "pao2fio2Ratio", Math.round(ratio), "derived");
        }

        if ("APACHE_II".equals(score)) {
            fields.put("apacheWindowActive", apacheWindow);
            fields.put("apacheWindowEnd", windowEnd.toString());
            fields.put("admittedAt", admittedAt.toString());
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("scoreType", score);
        result.put("visitId", visitId.toString());
        result.put("bedId", bedId);
        result.put("fields", fields);
        result.put("sources", sources);
        return result;
    }

    private String resolveBedId(UUID visitId) {
        return assignmentRepository.findByVisitIdAndActiveTrue(visitId)
                .flatMap(a -> bedRepository.findById(a.getBedId()))
                .map(b -> "ICU-1-" + b.getBedLabel())
                .orElse(null);
    }

    private Map<String, Double> readLatestVitalsMap(String bedId) {
        Map<String, Double> map = new HashMap<>();
        try {
            Map<String, Object> latest = vitalsReadService.getLatestVitals(bedId);
            collectVitalsFromResponse(latest, map);
        } catch (Exception ignored) {
        }
        return map;
    }

    @SuppressWarnings("unchecked")
    private void collectVitalsFromResponse(Map<String, Object> latest, Map<String, Double> map) {
        if (latest == null) return;
        for (String key : List.of("primaryAttributes", "secondaryAttributes")) {
            Object attrs = latest.get(key);
            if (!(attrs instanceof List<?> list)) continue;
            for (Object item : list) {
                if (!(item instanceof Map<?, ?> m)) continue;
                String name = String.valueOf(m.get("paramName"));
                Object val = m.get("value");
                if (val instanceof Number n) {
                    map.put(name, n.doubleValue());
                    map.put(normalizeKey(name), n.doubleValue());
                }
            }
        }
    }

    private Map<String, WorstVital> worstVitalsInWindow(String bedId, Instant from, Instant to) {
        Map<String, WorstVital> worst = new HashMap<>();
        try {
            Map<String, Object> history = vitalsHistoryService.getTrendHistory(bedId, from, to, true);
            Object seriesObj = history.get("series");
            if (!(seriesObj instanceof List<?> seriesList)) return worst;

            for (Object s : seriesList) {
                if (!(s instanceof Map<?, ?> series)) continue;
                String param = String.valueOf(series.get("paramName"));
                Object pointsObj = series.get("points");
                if (!(pointsObj instanceof List<?> points)) continue;

                for (Object p : points) {
                    if (!(p instanceof Map<?, ?> pt)) continue;
                    Object valObj = pt.get("value");
                    if (!(valObj instanceof Number val)) continue;
                    double v = val.doubleValue();
                    updateWorst(worst, param, v);
                    updateWorst(worst, normalizeKey(param), v);
                }
            }
        } catch (Exception ignored) {
        }
        return worst;
    }

    private void updateWorst(Map<String, WorstVital> worst, String key, double value) {
        WorstVital w = worst.get(key);
        if (w == null) {
            worst.put(key, new WorstVital(value, value));
            return;
        }
        w.min = Math.min(w.min, value);
        w.max = Math.max(w.max, value);
    }

    private Double pickVital(Map<String, Double> latest, Map<String, WorstVital> worst,
                           Set<String> keys, String scoreType) {
        if ("APACHE_II".equals(scoreType)) {
            return pickApacheWorst(worst, keys, latest);
        }
        for (String k : keys) {
            if (latest.containsKey(k)) return latest.get(k);
            for (Map.Entry<String, Double> e : latest.entrySet()) {
                if (normalizeKey(e.getKey()).equalsIgnoreCase(normalizeKey(k))) return e.getValue();
            }
        }
        return null;
    }

    private Double pickApacheWorst(Map<String, WorstVital> worst, Set<String> keys, Map<String, Double> latest) {
        for (String k : keys) {
            WorstVital w = worst.get(k);
            if (w != null) {
                if (RR_KEYS.contains(k) || HR_KEYS.contains(k) || TEMP_KEYS.contains(k)) return w.max;
                if (SPO2_KEYS.contains(k)) return w.min;
                if (BP_KEYS.contains(k)) return w.min;
                if (MAP_KEYS.contains(k)) return w.min;
                return w.max;
            }
        }
        for (String k : keys) {
            if (latest.containsKey(k)) return latest.get(k);
        }
        return null;
    }

    private Map<String, LabValue> indexLabs(List<HubLabResultEntity> labs) {
        Map<String, LabValue> map = new LinkedHashMap<>();
        for (HubLabResultEntity lab : labs) {
            String key = lab.getTestName() == null ? "" : lab.getTestName().toLowerCase(Locale.ROOT).trim();
            if (key.isBlank()) continue;
            try {
                double v = Double.parseDouble(lab.getValue().trim());
                map.putIfAbsent(key, new LabValue(v, lab.getUnit(), lab.getResultedAt()));
                String canon = canonicalLabKey(lab.getTestName());
                if (canon != null) map.putIfAbsent(canon, new LabValue(v, lab.getUnit(), lab.getResultedAt()));
            } catch (Exception ignored) {
            }
        }
        return map;
    }

    private String canonicalLabKey(String testName) {
        if (testName == null) return null;
        String u = testName.toUpperCase(Locale.ROOT);
        if (u.contains("SODIUM") || u.equals("NA")) return "sodium";
        if (u.contains("POTASSIUM") || u.equals("K")) return "potassium";
        if (u.contains("CREATININE")) return "creatinine";
        if (u.contains("WBC") || u.contains("WHITE BLOOD")) return "wbc";
        if (u.contains("PLATELET") || u.equals("PLT")) return "platelets";
        if (u.contains("BILIRUBIN")) return "bilirubin";
        if (u.contains("PH")) return "ph";
        if (u.contains("PAO2") || u.contains("PO2")) return "pao2";
        if (u.contains("HEMATOCRIT") || u.equals("HCT")) return "hematocrit";
        if (u.contains("HEMOGLOBIN") || u.equals("HB") || u.equals("HGB")) return "hb";
        return null;
    }

    private void putLab(Map<String, Object> fields, Map<String, String> sources,
                        String field, Map<String, LabValue> labs, String testKey, String unit) {
        LabValue lv = labs.get(testKey.toLowerCase(Locale.ROOT));
        if (lv == null) lv = labs.get(canonicalLabKey(testKey));
        if (lv != null) put(fields, sources, field, lv.value, "lab");
    }

    private void putVital(Map<String, Object> fields, Map<String, String> sources,
                          String field, Double value, String source) {
        if (value != null) put(fields, sources, field, value, source);
    }

    private void put(Map<String, Object> fields, Map<String, String> sources,
                     String key, Object value, String source) {
        fields.put(key, value);
        sources.put(key, source);
    }

    private Integer calcAge(LocalDate dob) {
        if (dob == null) return null;
        return Period.between(dob, LocalDate.now(ZoneId.systemDefault())).getYears();
    }

    private String normalizeKey(String key) {
        return key == null ? "" : key.replace(" ", "").replace(".", "").toLowerCase(Locale.ROOT);
    }

    private Double num(Object v) {
        if (v == null) return null;
        try { return Double.parseDouble(v.toString()); }
        catch (NumberFormatException e) { return null; }
    }

    private static class WorstVital {
        double min;
        double max;
        WorstVital(double min, double max) { this.min = min; this.max = max; }
    }

    private record LabValue(double value, String unit, Instant at) {}
}
