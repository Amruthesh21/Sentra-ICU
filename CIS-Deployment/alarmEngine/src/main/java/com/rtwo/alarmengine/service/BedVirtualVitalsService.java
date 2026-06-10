package com.rtwo.alarmengine.service;

import org.bson.Document;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Generates unique per-bed vitals for beds without a physical device simulator.
 * Uses live simulator readings as a clinical template, then applies bed-specific
 * offsets and drift so each patient shows distinct but realistic values.
 */
@Service
public class BedVirtualVitalsService {

    private static final List<String> TEMPLATE_DEVICES = List.of("BplUltimaPrime", "Agilia");

    private final MongoTemplate mongoTemplate;
    private final CisCenterService cisCenterService;
    private final BedDeviceService bedDeviceService;

    public BedVirtualVitalsService(MongoTemplate mongoTemplate,
                                   CisCenterService cisCenterService,
                                   BedDeviceService bedDeviceService) {
        this.mongoTemplate = mongoTemplate;
        this.cisCenterService = cisCenterService;
        this.bedDeviceService = bedDeviceService;
    }

    public Map<String, Object> generateForBed(String bedId) {
        if (!bedDeviceService.isVirtualSimulatorBed(bedDeviceService.resolveBedLabel(bedId))) {
            return null;
        }

        String bedLabel = bedDeviceService.resolveBedLabel(bedId);
        String visitId = cisCenterService.resolvePatientVisitId(bedId);
        int seed = Objects.hash(bedLabel, visitId != null ? visitId : bedLabel);

        Map<String, Double> template = loadLiveSimulatorTemplate();
        double t = System.currentTimeMillis() / 1000.0;
        double phase = (seed % 360) * Math.PI / 180.0;
        double slowPhase = t / 45.0 + phase;
        double fastPhase = t / 12.0 + phase * 1.7;

        double hrBase = pick(template, "HeartRate", "Pulse", "Heart Rate", 78.0);
        double hrOffset = (seed % 21) - 10;
        double heartRate = round0(clamp(hrBase + hrOffset + Math.sin(fastPhase) * 4 + Math.sin(slowPhase * 0.5) * 2, 55, 130));

        double spo2Base = pick(template, "SpO2", 97.0);
        double spo2 = round1(clamp(spo2Base + ((seed >> 3) % 5) - 2 + Math.sin(slowPhase * 1.2) * 0.6, 88, 100));

        double rrBase = pick(template, "Resp.Rate", "Resp.Rate", 16.0);
        double respRate = round0(clamp(rrBase + ((seed >> 5) % 7) - 3 + Math.sin(fastPhase * 0.8) * 2, 8, 28));

        double tempBase = pick(template, "Temp1", "Temp2", 36.6);
        if (tempBase < 30 || tempBase > 42) {
            tempBase = 36.6;
        }
        double temp1 = round1(tempBase + ((seed >> 7) % 9) * 0.1 - 0.4 + Math.sin(slowPhase * 0.3) * 0.15);

        double infVolBase = pick(template, "Inf Vol", 28.0);
        double infVol = round2(infVolBase + (seed % 15) + Math.sin(slowPhase * 0.4) * 2);

        double infRateBase = pick(template, "Inf Rate", 18.0);
        double infRate = round1(infRateBase + (seed % 11) - 5 + Math.sin(fastPhase * 0.6) * 1.5);

        double bolusVol = (seed % 3) == 0 ? round2(2 + Math.sin(slowPhase) * 1.5) : 0;
        double bolusRate = bolusVol > 0 ? 1200 : 0;

        List<Map<String, Object>> primary = new ArrayList<>();
        addParam(primary, "SpO2", spo2, "%");
        addParam(primary, "Heart Rate", heartRate, "bpm");
        addParam(primary, "HeartRate", heartRate, "bpm");
        addParam(primary, "Pulse", heartRate, "bpm");
        addParam(primary, "Resp.Rate", respRate, "bpm");
        addParam(primary, "Temp1", temp1, "°C");

        List<Map<String, Object>> secondary = new ArrayList<>();
        addParam(secondary, "Inf Vol", infVol, "ml");
        addParam(secondary, "Inf Rate", infRate, "ml/h");
        addParam(secondary, "Bolus Vol", bolusVol, "ml");
        addParam(secondary, "Bolus Rate", bolusRate, "ml/h");

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("bedId", normalizeBedId(bedId));
        response.put("timestamp", Instant.now().toString());
        response.put("deviceType", "CIS-virtual");
        response.put("primaryAttributes", primary);
        response.put("secondaryAttributes", secondary);
        response.put("source", "virtual-sim");
        response.put("simulationMode", "virtual");
        return response;
    }

    private Map<String, Double> loadLiveSimulatorTemplate() {
        Map<String, Double> values = new LinkedHashMap<>();
        for (String deviceId : TEMPLATE_DEVICES) {
            Document doc = mongoTemplate.findOne(
                    new Query(Criteria.where("metadata.deviceId").is(deviceId))
                            .with(Sort.by(Sort.Direction.DESC, "timestamp"))
                            .limit(1),
                    Document.class,
                    "historyVitals"
            );
            if (doc != null) {
                extractValues(doc, values);
            }
        }
        return values;
    }

    @SuppressWarnings("unchecked")
    private void extractValues(Document doc, Map<String, Double> values) {
        appendFromList(doc.get("primaryAttributes"), values);
        appendFromList(doc.get("secondaryAttributes"), values);
        appendFromList(doc.get("additionalAttributes"), values);
        Object data = doc.get("data");
        if (data instanceof Document dataDoc) {
            appendFromList(dataDoc.get("primaryAttributes"), values);
            appendFromList(dataDoc.get("secondaryAttributes"), values);
            appendFromList(dataDoc.get("additionalAttributes"), values);
        }
    }

    @SuppressWarnings("unchecked")
    private void appendFromList(Object attributesObj, Map<String, Double> values) {
        if (!(attributesObj instanceof List<?> list)) {
            return;
        }
        for (Object item : list) {
            Document attr = item instanceof Document d ? d : item instanceof Map<?, ?> m ? new Document((Map<String, Object>) m) : null;
            if (attr == null) {
                continue;
            }
            String name = firstNonBlank(attr.get("paramName"), attr.get("name"));
            Double value = toDouble(attr.get("value"));
            if (name != null && value != null && !values.containsKey(name)) {
                values.put(name, value);
            }
        }
    }

    private double pick(Map<String, Double> template, String key, double fallback) {
        Double v = template.get(key);
        return v != null ? v : fallback;
    }

    private double pick(Map<String, Double> template, String key, String altKey, double fallback) {
        Double v = template.get(key);
        if (v == null) {
            v = template.get(altKey);
        }
        return v != null ? v : fallback;
    }

    private double pick(Map<String, Double> template, String k1, String k2, String k3, double fallback) {
        for (String key : List.of(k1, k2, k3)) {
            Double v = template.get(key);
            if (v != null) {
                return v;
            }
        }
        return fallback;
    }

    private void addParam(List<Map<String, Object>> list, String name, double value, String unit) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("paramName", name);
        row.put("value", roundClinical(name, value));
        row.put("unit", unit);
        list.add(row);
    }

    private double roundClinical(String name, double value) {
        if ("SpO2".equals(name) || name.startsWith("Temp")) {
            return round1(value);
        }
        if ("Inf Vol".equals(name) || "Bolus Vol".equals(name)) {
            return round2(value);
        }
        if ("Inf Rate".equals(name)) {
            return round1(value);
        }
        if ("Heart Rate".equals(name) || "HeartRate".equals(name) || "Pulse".equals(name)
                || "Resp.Rate".equals(name) || "Bolus Rate".equals(name)) {
            return round0(value);
        }
        return round1(value);
    }

    private double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    private double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    private double round0(double value) {
        return Math.round(value);
    }

    private double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private Double toDouble(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        try {
            return Double.parseDouble(value.toString().trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private String firstNonBlank(Object... values) {
        for (Object value : values) {
            if (value != null && !value.toString().isBlank()) {
                return value.toString();
            }
        }
        return null;
    }

    private String normalizeBedId(String bedId) {
        if (bedId != null && bedId.matches("BED-\\d+")) {
            return "ICU-1-" + bedId;
        }
        return bedId;
    }
}
