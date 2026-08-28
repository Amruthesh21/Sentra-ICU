package com.sentraicu.alarmengine.hub.service;

import org.springframework.stereotype.Component;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class ClinicalDocumentOcrParser {

    private static final Map<String, String> LAB_ALIASES = linkedAliasMap();

    private static Map<String, String> linkedAliasMap() {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("HEMOGLOBIN", "Hb");
        m.put("HGB", "Hb");
        m.put("HB", "Hb");
        m.put("HAEMOGLOBIN", "Hb");
        m.put("WBC", "WBC");
        m.put("WHITE BLOOD CELL", "WBC");
        m.put("LEUKOCYTE", "WBC");
        m.put("RBC", "RBC");
        m.put("PLATELET", "Platelets");
        m.put("PLT", "Platelets");
        m.put("THROMBOCYTE", "Platelets");
        m.put("CREATININE", "Creatinine");
        m.put("CREAT", "Creatinine");
        m.put("BUN", "BUN");
        m.put("UREA", "BUN");
        m.put("SODIUM", "Sodium");
        m.put("NA+", "Sodium");
        m.put("NA", "Sodium");
        m.put("POTASSIUM", "Potassium");
        m.put("K+", "Potassium");
        m.put("K", "Potassium");
        m.put("GLUCOSE", "Glucose");
        m.put("HBA1C", "HbA1c");
        m.put("TROPONIN", "Troponin");
        m.put("LACTATE", "Lactate");
        m.put("BILIRUBIN", "Bilirubin");
        m.put("TOTAL BILIRUBIN", "Bilirubin");
        m.put("DIRECT BILIRUBIN", "Bilirubin");
        m.put("HEMATOCRIT", "Hematocrit");
        m.put("HCT", "Hematocrit");
        m.put("PCV", "Hematocrit");
        m.put("PH", "pH");
        m.put("PAO2", "PaO2");
        m.put("PO2", "PaO2");
        m.put("PARTIAL PRESSURE O2", "PaO2");
        m.put("PACO2", "PaCO2");
        m.put("PCO2", "PaCO2");
        m.put("FIO2", "FiO2");
        m.put("FRACTION INSPIRED OXYGEN", "FiO2");
        m.put("BICARB", "Bicarbonate");
        m.put("HCO3", "Bicarbonate");
        m.put("BASE EXCESS", "BaseExcess");
        m.put("BE", "BaseExcess");
        m.put("INR", "INR");
        m.put("PT", "PT");
        m.put("APTT", "APTT");
        m.put("ALBUMIN", "Albumin");
        m.put("MAGNESIUM", "Magnesium");
        m.put("CALCIUM", "Calcium");
        m.put("CHLORIDE", "Chloride");
        m.put("CL", "Chloride");
        return m;
    }

    private static final Pattern LAB_LINE = Pattern.compile(
            "^\\s*([A-Za-z][A-Za-z0-9\\s\\./\\-%]{1,45}?)\\s+([<>≤≥]?\\s*[0-9]+(?:\\.[0-9]+)?)\\s*([A-Za-z%/μµ^0-9\\.\\-]{0,14})?\\s*(?:([0-9]+(?:\\.[0-9]+)?\\s*[-–—]\\s*[0-9]+(?:\\.[0-9]+)?))?",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern LAB_COLON = Pattern.compile(
            "([A-Za-z][A-Za-z0-9\\s\\./\\-%]{2,35})\\s*[:=]\\s*([<>≤≥]?\\s*[0-9]+(?:\\.[0-9]+)?)\\s*([A-Za-z%/μµ^0-9\\.\\-]{0,14})?",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern LAB_PIPE = Pattern.compile(
            "^\\s*([A-Za-z][A-Za-z0-9\\s\\./\\-%]{2,35})\\s*[|¦]\\s*([<>≤≥]?\\s*[0-9]+(?:\\.[0-9]+)?)\\s*(?:[|¦]\\s*([A-Za-z%/μµ^0-9\\.\\-]{0,14}))?",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern LAB_TAB = Pattern.compile(
            "^\\s*([A-Za-z][A-Za-z0-9\\s\\./\\-%]{2,35})\\t+([<>≤≥]?\\s*[0-9]+(?:\\.[0-9]+)?)\\s*(?:\\t+([A-Za-z%/μµ^0-9\\.\\-]{0,14}))?",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern ABG_INLINE = Pattern.compile(
            "\\b(pH|PaO2|PO2|PaCO2|PCO2|FiO2|FIO2|HCO3|Bicarb(?:onate)?|BE|Base\\s*Excess)\\b\\s*[:=]?\\s*([<>≤≥]?\\s*[0-9]+(?:\\.[0-9]+)?)",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern VALUE_WITH_UNIT = Pattern.compile(
            "([0-9]+(?:\\.[0-9]+)?)\\s*(mmol/L|mg/dL|g/dL|10\\^?3/uL|10\\^?6/uL|%|mmHg|mEq/L|µmol/L|umol/L|IU/L)",
            Pattern.CASE_INSENSITIVE);

    public Map<String, Object> parse(String rawText) {
        String normalized = preprocess(rawText);
        List<Map<String, Object>> labs = parseLabs(normalized);
        parseAbgBlock(normalized, labs);
        parseInlineValues(normalized, labs);
        Map<String, Object> imaging = parseImaging(normalized);

        String documentType = "UNKNOWN";
        if (!labs.isEmpty() && imaging != null) documentType = "MIXED";
        else if (!labs.isEmpty()) documentType = "LAB";
        else if (imaging != null) documentType = "IMAGING";

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("documentType", documentType);
        result.put("labs", labs);
        result.put("imaging", imaging);
        result.put("confidence", scoreConfidence(labs, imaging, normalized));
        result.put("parsedLineCount", labs.size());
        return result;
    }

    private String preprocess(String raw) {
        if (raw == null) return "";
        String text = raw.replace('\r', '\n');
        text = text.replace('\u00A0', ' ');
        text = text.replaceAll("[|¦]", " | ");
        text = text.replaceAll("(?i)\\bO(?=\\d)", "0");
        text = text.replaceAll("(?m)^\\s*[-•*]\\s+", "");
        return text;
    }

    private List<Map<String, Object>> parseLabs(String text) {
        LinkedHashMap<String, Map<String, Object>> byTest = new LinkedHashMap<>();
        for (String line : text.split("\n")) {
            String trimmed = line.trim();
            if (trimmed.length() < 3 || isHeaderLine(trimmed)) continue;

            if (tryPattern(LAB_PIPE, trimmed, byTest)) continue;
            if (tryPattern(LAB_TAB, trimmed, byTest)) continue;
            if (tryPattern(LAB_LINE, trimmed, byTest)) continue;
            tryPattern(LAB_COLON, trimmed, byTest);
        }
        return new ArrayList<>(byTest.values());
    }

    private boolean tryPattern(Pattern pattern, String line, Map<String, Map<String, Object>> byTest) {
        Matcher m = pattern.matcher(line);
        if (!m.find()) return false;
        addLab(byTest, m.group(1), m.group(2), m.groupCount() >= 3 ? m.group(3) : null,
                m.groupCount() >= 4 ? m.group(4) : null);
        return true;
    }

    private void parseAbgBlock(String text, List<Map<String, Object>> labs) {
        LinkedHashMap<String, Map<String, Object>> byTest = indexLabs(labs);
        String upper = text.toUpperCase(Locale.ROOT);
        if (!upper.contains("ABG") && !upper.contains("BLOOD GAS") && !upper.contains("ARTERIAL")
                && !upper.contains("VENOUS GAS") && !text.toLowerCase(Locale.ROOT).contains("ph")) {
            return;
        }
        Matcher m = ABG_INLINE.matcher(text);
        while (m.find()) {
            addLab(byTest, m.group(1), m.group(2), null, null);
        }
        labs.clear();
        labs.addAll(byTest.values());
    }

    private void parseInlineValues(String text, List<Map<String, Object>> labs) {
        LinkedHashMap<String, Map<String, Object>> byTest = indexLabs(labs);
        for (Map.Entry<String, String> alias : LAB_ALIASES.entrySet()) {
            Pattern p = Pattern.compile(
                    "\\b" + Pattern.quote(alias.getKey()) + "\\b[^0-9]{0,12}([<>≤≥]?\\s*[0-9]+(?:\\.[0-9]+)?)",
                    Pattern.CASE_INSENSITIVE);
            Matcher m = p.matcher(text);
            if (m.find()) {
                addLab(byTest, alias.getKey(), m.group(1), null, null);
            }
        }
        labs.clear();
        labs.addAll(byTest.values());
    }

    private LinkedHashMap<String, Map<String, Object>> indexLabs(List<Map<String, Object>> labs) {
        LinkedHashMap<String, Map<String, Object>> byTest = new LinkedHashMap<>();
        for (Map<String, Object> lab : labs) {
            String name = String.valueOf(lab.get("testName"));
            byTest.put(name.toLowerCase(Locale.ROOT), lab);
        }
        return byTest;
    }

    private void addLab(Map<String, Map<String, Object>> byTest,
                        String testRaw, String value, String unit, String ref) {
        if (testRaw == null || value == null) return;
        String cleanedValue = cleanValue(value);
        if (cleanedValue.isBlank()) return;

        String testName = normalizeTestName(testRaw.trim());
        if (testName.length() < 2 || isNoiseTest(testName)) return;

        String resolvedUnit = unit != null && !unit.isBlank() ? unit.trim() : guessUnit(testName);
        if ((resolvedUnit == null || resolvedUnit.isBlank()) && ref == null) {
            Matcher vu = VALUE_WITH_UNIT.matcher(testRaw + " " + value);
            if (vu.find()) resolvedUnit = vu.group(2);
        }

        Map<String, Object> lab = new LinkedHashMap<>();
        lab.put("testName", testName);
        lab.put("value", cleanedValue);
        lab.put("unit", resolvedUnit != null ? resolvedUnit : "");
        lab.put("referenceRange", ref != null ? ref.replaceAll("\\s+", "") : "");
        lab.put("flag", inferFlag(cleanedValue, ref));
        byTest.putIfAbsent(testName.toLowerCase(Locale.ROOT), lab);
    }

    private String cleanValue(String raw) {
        String v = raw.replaceAll("[<>≤≥]", "").trim();
        v = v.replace(',', '.');
        if (v.matches("^[0-9]+\\.[0-9]+\\.[0-9]+$")) {
            v = v.replaceFirst("\\.", "");
        }
        return v;
    }

    private Map<String, Object> parseImaging(String text) {
        String upper = text.toUpperCase(Locale.ROOT);
        boolean hasImagingKeyword = upper.contains("IMPRESSION")
                || upper.contains("FINDINGS")
                || upper.contains("RADIOLOGY")
                || upper.contains("X-RAY")
                || upper.contains("XRAY")
                || upper.contains(" CHEST ")
                || upper.contains("CT ")
                || upper.contains("MRI ")
                || upper.contains("ULTRASOUND")
                || upper.contains("SONOGRAPHY");

        if (!hasImagingKeyword) return null;

        Map<String, Object> imaging = new LinkedHashMap<>();
        imaging.put("modality", detectModality(upper));
        imaging.put("studyName", detectStudyName(text));
        imaging.put("findings", extractSection(text, "FINDINGS", "IMPRESSION", "CONCLUSION", "RECOMMENDATION"));
        imaging.put("impression", extractSection(text, "IMPRESSION", "CONCLUSION", "RECOMMENDATION", null));

        if (imaging.get("studyName") == null && imaging.get("findings") == null && imaging.get("impression") == null) {
            return null;
        }
        return imaging;
    }

    private String detectModality(String upper) {
        if (upper.contains("MRI")) return "MRI";
        if (upper.contains(" CT ") || upper.startsWith("CT ") || upper.contains("COMPUTED TOMOGRAPHY")) return "CT";
        if (upper.contains("ULTRASOUND") || upper.contains(" US ") || upper.contains("SONOGRAPHY")) return "US";
        return "X-RAY";
    }

    private String detectStudyName(String text) {
        for (String line : text.split("\n")) {
            String t = line.trim();
            if (t.length() < 4 || t.length() > 80) continue;
            String u = t.toUpperCase(Locale.ROOT);
            if (u.contains("CHEST") || u.contains("ABDOMEN") || u.contains("HEAD") || u.contains("PELVIS")
                    || u.contains("X-RAY") || u.contains("XRAY") || u.contains("CT ") || u.contains("MRI")) {
                return t;
            }
        }
        return "Imaging study";
    }

    private String extractSection(String text, String startLabel, String endLabel1, String endLabel2, String endLabel3) {
        String upper = text.toUpperCase(Locale.ROOT);
        int start = indexOfLabel(upper, startLabel);
        if (start < 0) return null;

        int contentStart = text.indexOf('\n', start);
        if (contentStart < 0) contentStart = start + startLabel.length();
        else contentStart++;

        int end = text.length();
        for (String label : List.of(endLabel1, endLabel2, endLabel3)) {
            if (label == null || label.equalsIgnoreCase(startLabel)) continue;
            int idx = indexOfLabel(upper, label);
            if (idx > start && idx < end) end = idx;
        }

        String section = text.substring(contentStart, end).trim();
        section = section.replaceAll("(?m)^\\s*[-_:]+\\s*", "").trim();
        return section.isBlank() ? null : section;
    }

    private int indexOfLabel(String upper, String label) {
        int idx = upper.indexOf(label);
        if (idx < 0) return -1;
        if (idx > 0 && Character.isLetterOrDigit(upper.charAt(idx - 1))) return -1;
        return idx;
    }

    private String normalizeTestName(String raw) {
        String key = raw.toUpperCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
        for (Map.Entry<String, String> e : LAB_ALIASES.entrySet()) {
            if (key.equals(e.getKey()) || key.contains(e.getKey())) return e.getValue();
        }
        if (raw.length() > 28) return raw.substring(0, 28).trim();
        return raw;
    }

    private String guessUnit(String testName) {
        String t = testName.toLowerCase(Locale.ROOT);
        if (t.contains("hb") || t.contains("hemoglobin") || t.contains("albumin")) return "g/dL";
        if (t.contains("wbc") || t.contains("rbc") || t.contains("platelet")) return "10^3/uL";
        if (t.contains("sodium") || t.contains("potassium") || t.contains("chloride")
                || t.contains("bicarb") || t.contains("magnesium") || t.contains("calcium")) return "mmol/L";
        if (t.contains("creatinine") || t.contains("bun") || t.contains("glucose")
                || t.contains("bilirubin")) return "mg/dL";
        if (t.contains("ph")) return "";
        if (t.contains("pao2") || t.contains("paco2") || t.contains("fio2")) return "mmHg";
        if (t.contains("hematocrit") || t.contains("fio2")) return "%";
        return "";
    }

    private String inferFlag(String value, String ref) {
        if (ref == null || ref.isBlank()) return "NORMAL";
        try {
            double v = Double.parseDouble(value);
            String[] parts = ref.replaceAll("\\s+", "").split("[-–—]");
            if (parts.length == 2) {
                double low = Double.parseDouble(parts[0]);
                double high = Double.parseDouble(parts[1]);
                if (v < low) return "LOW";
                if (v > high) return "HIGH";
            }
        } catch (NumberFormatException ignored) {
        }
        return "NORMAL";
    }

    private String scoreConfidence(List<Map<String, Object>> labs, Map<String, Object> imaging, String text) {
        int score = labs.size() * 2 + (imaging != null ? 3 : 0);
        if (text.toUpperCase(Locale.ROOT).contains("LAB")) score += 1;
        if (score >= 10) return "high";
        if (score >= 4) return "medium";
        return labs.isEmpty() && imaging == null ? "low" : "medium";
    }

    private boolean isHeaderLine(String line) {
        String u = line.toUpperCase(Locale.ROOT);
        return u.contains("TEST NAME") || u.contains("RESULT") && u.contains("UNIT")
                || u.equals("LAB REPORT") || u.startsWith("PAGE ")
                || u.contains("PARAMETER") && u.contains("VALUE");
    }

    private boolean isNoiseTest(String name) {
        String u = name.toUpperCase(Locale.ROOT);
        return u.equals("DATE") || u.equals("TIME") || u.equals("MRN") || u.equals("PATIENT")
                || u.equals("AGE") || u.equals("SEX") || u.contains("REPORT")
                || u.equals("SPECIMEN") || u.equals("SAMPLE");
    }
}
