package com.sentraicu.alarmengine.hub.scoring;

import java.util.*;

/**
 * Clinical score calculators — NEWS2, SOFA, APACHE II, RASS, CAM-ICU.
 */
public final class HubScoringCalculator {

    private HubScoringCalculator() {}

    public static Map<String, Object> compute(String scoreType, Map<String, Object> inputs) {
        return switch (normalizeType(scoreType)) {
            case "NEWS2" -> computeNews2(inputs);
            case "SOFA" -> computeSofa(inputs);
            case "APACHE_II" -> computeApacheII(inputs);
            case "RASS" -> computeRass(inputs);
            case "CAM_ICU" -> computeCamIcu(inputs);
            default -> throw new IllegalArgumentException("Unknown score type: " + scoreType);
        };
    }

    public static String normalizeType(String type) {
        if (type == null) return "";
        return type.trim().toUpperCase(Locale.ROOT)
                .replace(' ', '_')
                .replace('-', '_');
    }

    // ─── NEWS2 ───────────────────────────────────────────────

    public static Map<String, Object> computeNews2(Map<String, Object> in) {
        Map<String, Object> breakdown = new LinkedHashMap<>();
        int total = 0;

        double rr = d(in, "respRate");
        int rrPts = rr <= 8 ? 3 : rr <= 11 ? 1 : rr <= 20 ? 0 : rr <= 24 ? 2 : 3;
        breakdown.put("respRate", pts(rrPts, rr));
        total += rrPts;

        boolean hypercapnic = bool(in, "hypercapnicRespFailure");
        double spo2 = d(in, "spo2");
        int spo2Pts;
        if (hypercapnic) {
            spo2Pts = spo2 <= 83 ? 3 : spo2 <= 85 ? 2 : spo2 <= 87 ? 1
                    : (spo2 <= 92 || spo2 >= 93) ? 0 : spo2 <= 94 ? 1 : spo2 <= 96 ? 2 : 3;
        } else {
            spo2Pts = spo2 <= 91 ? 3 : spo2 <= 93 ? 2 : spo2 <= 95 ? 1 : 0;
        }
        breakdown.put("spo2", pts(spo2Pts, spo2));
        total += spo2Pts;

        boolean supplemental = bool(in, "supplementalOxygen");
        int o2Pts = supplemental ? 2 : 0;
        breakdown.put("supplementalOxygen", pts(o2Pts, supplemental));
        total += o2Pts;

        double temp = d(in, "temperature");
        int tempPts = temp <= 35.0 ? 3 : temp <= 36.0 ? 1 : temp <= 38.0 ? 0 : temp <= 39.0 ? 1 : 2;
        breakdown.put("temperature", pts(tempPts, temp));
        total += tempPts;

        double sbp = d(in, "systolicBp");
        int sbpPts = sbp <= 90 ? 3 : sbp <= 100 ? 2 : sbp <= 110 ? 1 : sbp <= 219 ? 0 : 3;
        breakdown.put("systolicBp", pts(sbpPts, sbp));
        total += sbpPts;

        double pulse = d(in, "pulse");
        int pulsePts = pulse <= 40 ? 3 : pulse <= 50 ? 1 : pulse <= 90 ? 0 : pulse <= 110 ? 1 : pulse <= 130 ? 2 : 3;
        breakdown.put("pulse", pts(pulsePts, pulse));
        total += pulsePts;

        String consciousness = str(in, "consciousness", "ALERT").toUpperCase(Locale.ROOT);
        int conPts = "ALERT".equals(consciousness) ? 0 : 3;
        breakdown.put("consciousness", pts(conPts, consciousness));
        total += conPts;

        String risk;
        String interpretation;
        if (total >= 7) {
            risk = "HIGH";
            interpretation = "High risk — continuous monitoring; critical care assessment";
        } else if (total >= 5) {
            risk = "MEDIUM";
            interpretation = "Medium risk — urgent ward-based review";
        } else if (rrPts == 3 || spo2Pts == 3 || o2Pts == 3 || tempPts == 3 || sbpPts == 3 || pulsePts == 3 || conPts == 3) {
            risk = "LOW_MEDIUM";
            interpretation = "Low-medium — single parameter score 3; minimum hourly review";
        } else {
            risk = "LOW";
            interpretation = "Low risk — routine monitoring per protocol";
        }

        return result(total, risk, interpretation, breakdown);
    }

    // ─── SOFA ────────────────────────────────────────────────

    public static Map<String, Object> computeSofa(Map<String, Object> in) {
        Map<String, Object> breakdown = new LinkedHashMap<>();
        int total = 0;

        int resp = componentOrDerived(in, "sofaResp", deriveSofaResp(in));
        int coag = componentOrDerived(in, "sofaCoag", deriveSofaCoag(in));
        int liver = componentOrDerived(in, "sofaLiver", deriveSofaLiver(in));
        int cardio = componentOrDerived(in, "sofaCardio", deriveSofaCardio(in));
        int cns = componentOrDerived(in, "sofaCns", deriveSofaCns(in));
        int renal = componentOrDerived(in, "sofaRenal", deriveSofaRenal(in));

        breakdown.put("respiration", pts(resp, in.get("pao2fio2Ratio")));
        breakdown.put("coagulation", pts(coag, in.get("platelets")));
        breakdown.put("liver", pts(liver, in.get("bilirubin")));
        breakdown.put("cardiovascular", pts(cardio, in.get("map")));
        breakdown.put("cns", pts(cns, in.get("gcs")));
        breakdown.put("renal", pts(renal, in.get("creatinine")));
        total = resp + coag + liver + cardio + cns + renal;

        String risk = total >= 11 ? "HIGH" : total >= 6 ? "MEDIUM" : "LOW";
        String interpretation = "SOFA " + total + " — organ failure score (0–24)";
        return result(total, risk, interpretation, breakdown);
    }

    private static int deriveSofaResp(Map<String, Object> in) {
        double ratio = d(in, "pao2fio2Ratio");
        if (ratio <= 0) return 0;
        if (ratio < 100) return 4;
        if (ratio < 200) return 3;
        if (ratio < 300) return 2;
        if (ratio < 400) return 1;
        return 0;
    }

    private static int deriveSofaCoag(Map<String, Object> in) {
        double plt = d(in, "platelets");
        if (plt <= 0) return 0;
        if (plt < 20) return 4;
        if (plt < 50) return 3;
        if (plt < 100) return 2;
        if (plt < 150) return 1;
        return 0;
    }

    private static int deriveSofaLiver(Map<String, Object> in) {
        double bili = d(in, "bilirubin");
        if (bili <= 0) return 0;
        if (bili >= 12) return 4;
        if (bili >= 6) return 3;
        if (bili >= 2) return 2;
        if (bili >= 1.2) return 1;
        return 0;
    }

    private static int deriveSofaCardio(Map<String, Object> in) {
        if (in.containsKey("sofaCardio")) return i(in, "sofaCardio");
        double map = d(in, "map");
        if (map > 0 && map < 70) return 1;
        return 0;
    }

    private static int deriveSofaCns(Map<String, Object> in) {
        int gcs = i(in, "gcs");
        if (gcs <= 0) return 0;
        if (gcs < 6) return 4;
        if (gcs < 10) return 3;
        if (gcs < 13) return 2;
        if (gcs < 15) return 1;
        return 0;
    }

    private static int deriveSofaRenal(Map<String, Object> in) {
        double cr = d(in, "creatinine");
        double uop = d(in, "urineOutputMlDay");
        if (cr >= 5 || (uop > 0 && uop < 200)) return 4;
        if (cr >= 3.5 || (uop > 0 && uop < 500)) return 3;
        if (cr >= 2) return 2;
        if (cr >= 1.2) return 1;
        return 0;
    }

    // ─── APACHE II ─────────────────────────────────────────

    public static Map<String, Object> computeApacheII(Map<String, Object> in) {
        Map<String, Object> breakdown = new LinkedHashMap<>();
        int total = 0;

        int agePts = apacheAge(i(in, "age"));
        breakdown.put("age", pts(agePts, in.get("age")));
        total += agePts;

        int chronicPts = apacheChronic(str(in, "chronicOrgan", "NONE"));
        breakdown.put("chronicOrgan", pts(chronicPts, in.get("chronicOrgan")));
        total += chronicPts;

        int tempPts = apacheTemp(d(in, "temperature"));
        breakdown.put("temperature", pts(tempPts, in.get("temperature")));
        total += tempPts;

        int mapPts = apacheMap(d(in, "map"));
        breakdown.put("map", pts(mapPts, in.get("map")));
        total += mapPts;

        int hrPts = apacheHr(d(in, "heartRate"));
        breakdown.put("heartRate", pts(hrPts, in.get("heartRate")));
        total += hrPts;

        int rrPts = apacheRr(d(in, "respRate"));
        breakdown.put("respRate", pts(rrPts, in.get("respRate")));
        total += rrPts;

        int oxyPts = apacheOxygenation(in);
        breakdown.put("oxygenation", pts(oxyPts, in.get("oxygenationPoints")));
        total += oxyPts;

        int phPts = apachePh(d(in, "ph"));
        breakdown.put("ph", pts(phPts, in.get("ph")));
        total += phPts;

        int naPts = apacheSodium(d(in, "sodium"));
        breakdown.put("sodium", pts(naPts, in.get("sodium")));
        total += naPts;

        int kPts = apachePotassium(d(in, "potassium"));
        breakdown.put("potassium", pts(kPts, in.get("potassium")));
        total += kPts;

        int crPts = apacheCreatinine(d(in, "creatinine"), bool(in, "acuteRenalFailure"), bool(in, "chronicRenalFailure"));
        breakdown.put("creatinine", pts(crPts, in.get("creatinine")));
        total += crPts;

        int hctPts = apacheHematocrit(d(in, "hematocrit"));
        breakdown.put("hematocrit", pts(hctPts, in.get("hematocrit")));
        total += hctPts;

        int wbcPts = apacheWbc(d(in, "wbc"));
        breakdown.put("wbc", pts(wbcPts, in.get("wbc")));
        total += wbcPts;

        int gcs = i(in, "gcs");
        int gcsPts = gcs > 0 ? Math.max(0, 15 - gcs) : 0;
        breakdown.put("gcs", pts(gcsPts, gcs));
        total += gcsPts;

        String mortality = apacheMortalityBand(total, str(in, "chronicOrgan", "NONE"));
        String interpretation = "APACHE II " + total + " — estimated mortality band: " + mortality;
        String risk = total >= 25 ? "HIGH" : total >= 15 ? "MEDIUM" : "LOW";
        return result(total, risk, interpretation, breakdown);
    }

    private static int apacheAge(int age) {
        if (age <= 0) return 0;
        if (age <= 44) return 0;
        if (age <= 54) return 2;
        if (age <= 64) return 3;
        if (age <= 74) return 5;
        return 6;
    }

    private static int apacheChronic(String type) {
        return switch (type.toUpperCase(Locale.ROOT)) {
            case "EMERGENCY_NONOP", "NONOPERATIVE" -> 5;
            case "ELECTIVE_POSTOP", "ELECTIVE" -> 2;
            default -> 0;
        };
    }

    private static int apacheTemp(double t) {
        if (t <= 0) return 0;
        if (t >= 41) return 4;
        if (t >= 39) return 3;
        if (t >= 38.5) return 1;
        if (t >= 36) return 0;
        if (t >= 34) return 1;
        if (t >= 32) return 2;
        if (t >= 30) return 3;
        return 4;
    }

    private static int apacheMap(double map) {
        if (map <= 0) return 0;
        if (map > 159) return 4;
        if (map > 129) return 3;
        if (map > 109) return 2;
        if (map > 69) return 0;
        if (map > 49) return 2;
        return 4;
    }

    private static int apacheHr(double hr) {
        if (hr <= 0) return 0;
        if (hr >= 180) return 4;
        if (hr >= 140) return 3;
        if (hr >= 110) return 2;
        if (hr >= 70) return 0;
        if (hr >= 55) return 2;
        if (hr >= 40) return 3;
        return 4;
    }

    private static int apacheRr(double rr) {
        if (rr <= 0) return 0;
        if (rr >= 50) return 4;
        if (rr >= 35) return 3;
        if (rr >= 25) return 1;
        if (rr >= 12) return 0;
        if (rr >= 10) return 1;
        if (rr >= 6) return 2;
        return 4;
    }

    private static int apacheOxygenation(Map<String, Object> in) {
        if (in.containsKey("oxygenationPoints")) return i(in, "oxygenationPoints");
        double fio2 = d(in, "fio2");
        double pao2 = d(in, "pao2");
        double aagrad = d(in, "aaGradient");
        if (fio2 >= 50) {
            if (aagrad > 499) return 4;
            if (aagrad >= 350) return 3;
            if (aagrad >= 200) return 2;
            return 0;
        }
        if (pao2 > 70) return 0;
        if (pao2 >= 61) return 1;
        if (pao2 >= 55) return 3;
        if (pao2 > 0) return 4;
        return 0;
    }

    private static int apachePh(double ph) {
        if (ph <= 0) return 0;
        if (ph >= 7.7) return 4;
        if (ph >= 7.6) return 3;
        if (ph >= 7.5) return 1;
        if (ph >= 7.33) return 0;
        if (ph >= 7.25) return 2;
        if (ph >= 7.15) return 3;
        return 4;
    }

    private static int apacheSodium(double na) {
        if (na <= 0) return 0;
        if (na >= 180) return 4;
        if (na >= 160) return 3;
        if (na >= 155) return 2;
        if (na >= 150) return 1;
        if (na >= 130) return 0;
        if (na >= 120) return 2;
        if (na >= 111) return 3;
        return 4;
    }

    private static int apachePotassium(double k) {
        if (k <= 0) return 0;
        if (k >= 7) return 4;
        if (k >= 6) return 3;
        if (k >= 5.5) return 1;
        if (k >= 3.5) return 0;
        if (k >= 3) return 1;
        if (k >= 2.5) return 2;
        return 4;
    }

    private static int apacheCreatinine(double cr, boolean acute, boolean chronic) {
        if (cr <= 0) return 0;
        if (cr >= 3.5) return acute ? 8 : 4;
        if (cr >= 2.0) return acute ? 6 : (chronic ? 3 : 0);
        if (cr >= 1.5) return acute ? 4 : (chronic ? 2 : 0);
        if (cr >= 0.6) return 0;
        return 2;
    }

    private static int apacheHematocrit(double hct) {
        if (hct <= 0) return 0;
        if (hct >= 60) return 4;
        if (hct >= 50) return 2;
        if (hct >= 46) return 1;
        if (hct >= 30) return 0;
        if (hct >= 20) return 2;
        return 4;
    }

    private static int apacheWbc(double wbc) {
        if (wbc <= 0) return 0;
        if (wbc >= 40) return 4;
        if (wbc >= 20) return 2;
        if (wbc >= 15) return 1;
        if (wbc >= 3) return 0;
        if (wbc >= 1) return 2;
        return 4;
    }

    private static String apacheMortalityBand(int score, String chronic) {
        boolean postop = chronic.toUpperCase(Locale.ROOT).contains("POSTOP")
                || chronic.toUpperCase(Locale.ROOT).contains("ELECTIVE");
        if (score <= 4) return postop ? "~1%" : "~4%";
        if (score <= 9) return postop ? "~3%" : "~8%";
        if (score <= 14) return postop ? "~7%" : "~15%";
        if (score <= 19) return postop ? "~12%" : "~25%";
        if (score <= 24) return postop ? "~30%" : "~40%";
        if (score <= 29) return postop ? "~35%" : "~55%";
        if (score <= 34) return "~73%";
        return postop ? "~88%" : "~85%";
    }

    // ─── RASS ────────────────────────────────────────────────

    public static Map<String, Object> computeRass(Map<String, Object> in) {
        int level = i(in, "rassLevel");
        Map<String, Object> breakdown = new LinkedHashMap<>();
        breakdown.put("rassLevel", pts(level, level));
        String interpretation = rassLabel(level);
        return result(level, level >= 2 ? "HIGH" : level <= -3 ? "MEDIUM" : "LOW", interpretation, breakdown);
    }

    private static String rassLabel(int level) {
        return switch (level) {
            case 4 -> "Combative (+4)";
            case 3 -> "Very agitated (+3)";
            case 2 -> "Agitated (+2)";
            case 1 -> "Restless (+1)";
            case 0 -> "Alert and calm (0)";
            case -1 -> "Drowsy (-1)";
            case -2 -> "Light sedation (-2)";
            case -3 -> "Moderate sedation (-3)";
            case -4 -> "Deep sedation (-4)";
            case -5 -> "Unarousable (-5)";
            default -> "RASS " + level;
        };
    }

    // ─── CAM-ICU ───────────────────────────────────────────

    public static Map<String, Object> computeCamIcu(Map<String, Object> in) {
        int rass = i(in, "rassLevel");
        Map<String, Object> breakdown = new LinkedHashMap<>();
        breakdown.put("rassLevel", Map.of("value", rass, "points", 0));

        if (rass < -3) {
            return camResult(false, "Cannot assess — RASS < -3 (too sedated)", breakdown);
        }

        boolean acute = bool(in, "acuteMentalStatusChange");
        boolean inattention = bool(in, "inattention");
        boolean altered = bool(in, "alteredConsciousness");
        boolean disorganized = bool(in, "disorganizedThinking");
        int commandErrors = i(in, "commandErrors");

        breakdown.put("acuteMentalStatusChange", Map.of("value", acute));
        breakdown.put("inattention", Map.of("value", inattention));
        breakdown.put("alteredConsciousness", Map.of("value", altered));
        breakdown.put("disorganizedThinking", Map.of("value", disorganized));

        boolean positive = acute && inattention && (altered || disorganized || (rass != 0 && commandErrors > 1));
        String interpretation = positive ? "CAM-ICU POSITIVE — delirium present" : "CAM-ICU negative";
        return camResult(positive, interpretation, breakdown);
    }

    private static Map<String, Object> camResult(boolean positive, String interpretation, Map<String, Object> breakdown) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("totalScore", positive ? 1 : 0);
        r.put("riskLevel", positive ? "HIGH" : "LOW");
        r.put("interpretation", interpretation);
        r.put("camPositive", positive);
        r.put("breakdown", breakdown);
        return r;
    }

    // ─── helpers ─────────────────────────────────────────────

    private static Map<String, Object> result(int total, String risk, String interpretation, Map<String, Object> breakdown) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("totalScore", total);
        r.put("riskLevel", risk);
        r.put("interpretation", interpretation);
        r.put("breakdown", breakdown);
        return r;
    }

    private static Map<String, Object> pts(int points, Object value) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("points", points);
        if (value != null) m.put("value", value);
        return m;
    }

    private static int componentOrDerived(Map<String, Object> in, String key, int derived) {
        if (in.containsKey(key) && in.get(key) != null && !in.get(key).toString().isBlank()) {
            return Math.min(4, Math.max(0, i(in, key)));
        }
        return derived;
    }

    private static double d(Map<String, Object> m, String key) {
        Object v = m.get(key);
        if (v == null || v.toString().isBlank()) return 0;
        try { return Double.parseDouble(v.toString().trim()); }
        catch (NumberFormatException e) { return 0; }
    }

    private static int i(Map<String, Object> m, String key) {
        Object v = m.get(key);
        if (v == null || v.toString().isBlank()) return 0;
        try { return (int) Math.round(Double.parseDouble(v.toString().trim())); }
        catch (NumberFormatException e) { return 0; }
    }

    private static boolean bool(Map<String, Object> m, String key) {
        Object v = m.get(key);
        if (v == null) return false;
        if (v instanceof Boolean b) return b;
        String s = v.toString().trim().toLowerCase(Locale.ROOT);
        return "true".equals(s) || "yes".equals(s) || "1".equals(s);
    }

    private static String str(Map<String, Object> m, String key, String fallback) {
        Object v = m.get(key);
        if (v == null || v.toString().isBlank()) return fallback;
        return v.toString().trim();
    }
}
