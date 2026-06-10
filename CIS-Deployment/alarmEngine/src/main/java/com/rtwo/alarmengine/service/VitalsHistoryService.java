package com.rtwo.alarmengine.service;

import org.bson.Document;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class VitalsHistoryService {

    private final MongoTemplate mongoTemplate;
    private final CisCenterService cisCenterService;
    private final BedDeviceService bedDeviceService;
    private final VitalTrendBufferService trendBufferService;

    public VitalsHistoryService(MongoTemplate mongoTemplate,
                                CisCenterService cisCenterService,
                                BedDeviceService bedDeviceService,
                                VitalTrendBufferService trendBufferService) {
        this.mongoTemplate = mongoTemplate;
        this.cisCenterService = cisCenterService;
        this.bedDeviceService = bedDeviceService;
        this.trendBufferService = trendBufferService;
    }

    public Map<String, Object> getTrendHistory(String bedId, int minutes) {
        if (cisCenterService.resolvePatientVisitId(bedId) == null) {
            return Map.of("bedId", bedId, "series", List.of(), "source", "none");
        }

        Instant since = Instant.now().minus(minutes, ChronoUnit.MINUTES);
        Map<String, List<Map<String, Object>>> seriesMap = new LinkedHashMap<>();

        String patientVisitId = cisCenterService.resolvePatientVisitId(bedId);
        if (patientVisitId != null) {
            loadMongoSeries(seriesMap, Criteria.where("metadata.patientId").is(patientVisitId), since);
        }

        if (seriesMap.isEmpty()) {
            String bedLabel = bedDeviceService.resolveBedLabel(bedId);
            if (bedDeviceService.isLiveSimulatorBed(bedLabel)) {
                List<String> deviceIds = bedDeviceService.getBedDeviceIds(bedLabel);
                for (String deviceId : deviceIds) {
                    loadMongoSeries(seriesMap,
                            Criteria.where("metadata.deviceId").is(deviceId),
                            since);
                }
            }
        }

        mergeBufferSeries(seriesMap, trendBufferService.getSeriesForBed(bedId));

        List<Map<String, Object>> series = buildSeriesList(seriesMap);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("bedId", bedId);
        result.put("minutes", minutes);
        result.put("series", series);
        result.put("source", series.isEmpty() ? "none" : patientVisitId != null ? "mongodb+buffer" : "device+buffer");
        return result;
    }

    private void loadMongoSeries(Map<String, List<Map<String, Object>>> seriesMap, Criteria criteria, Instant since) {
        Query query = new Query(criteria.and("timestamp").gte(Date.from(since)))
                .with(Sort.by(Sort.Direction.ASC, "timestamp"))
                .limit(500);
        List<Document> docs = mongoTemplate.find(query, Document.class, "historyVitals");
        for (Document doc : docs) {
            Instant ts = parseInstant(doc.get("timestamp"));
            if (ts == null) {
                continue;
            }
            collectSeries(seriesMap, doc.get("primaryAttributes"), ts);
            collectSeries(seriesMap, doc.get("additionalAttributes"), ts);
            collectSeries(seriesMap, doc.get("secondaryAttributes"), ts);
        }
    }

    @SuppressWarnings("unchecked")
    private void mergeBufferSeries(Map<String, List<Map<String, Object>>> seriesMap,
                                   List<Map<String, Object>> bufferSeries) {
        for (Map<String, Object> entry : bufferSeries) {
            String paramName = String.valueOf(entry.get("paramName"));
            Object pointsObj = entry.get("points");
            if (!(pointsObj instanceof List<?> points)) {
                continue;
            }
            List<Map<String, Object>> target = seriesMap.computeIfAbsent(paramName, k -> new ArrayList<>());
            for (Object p : points) {
                if (p instanceof Map<?, ?> point) {
                    target.add(new LinkedHashMap<>((Map<String, Object>) point));
                }
            }
        }
    }

    private List<Map<String, Object>> buildSeriesList(Map<String, List<Map<String, Object>>> seriesMap) {
        List<Map<String, Object>> series = new ArrayList<>();
        Set<String> preferred = Set.of(
                "SpO2", "Pulse", "Heart Rate", "HeartRate", "Temp1", "Resp.Rate",
                "PEEP", "MV", "Peak", "VT", "Inf Rate", "Inf Vol"
        );
        for (String param : preferred) {
            if (seriesMap.containsKey(param) && !seriesMap.get(param).isEmpty()) {
                series.add(Map.of("paramName", param, "points", dedupePoints(seriesMap.get(param))));
            }
        }
        for (Map.Entry<String, List<Map<String, Object>>> entry : seriesMap.entrySet()) {
            if (!preferred.contains(entry.getKey()) && !entry.getValue().isEmpty()) {
                series.add(Map.of("paramName", entry.getKey(), "points", dedupePoints(entry.getValue())));
            }
        }
        return series;
    }

    private List<Map<String, Object>> dedupePoints(List<Map<String, Object>> points) {
        Map<String, Map<String, Object>> byTs = new LinkedHashMap<>();
        for (Map<String, Object> point : points) {
            Object ts = point.get("timestamp");
            if (ts != null) {
                byTs.put(ts.toString(), point);
            }
        }
        return new ArrayList<>(byTs.values());
    }

    @SuppressWarnings("unchecked")
    private void collectSeries(Map<String, List<Map<String, Object>>> seriesMap, Object attrsObj, Instant ts) {
        if (!(attrsObj instanceof List<?> list)) {
            return;
        }
        for (Object item : list) {
            Document attr = item instanceof Document d ? d : new Document((Map<String, Object>) item);
            String name = firstNonBlank(attr.get("paramName"), attr.get("name"));
            Double value = toDouble(attr.get("value"));
            if (name == null || value == null) {
                continue;
            }

            seriesMap.computeIfAbsent(name, k -> new ArrayList<>())
                    .add(Map.of("timestamp", ts.toString(), "value", value));

            if ("Pulse".equalsIgnoreCase(name)) {
                seriesMap.computeIfAbsent("HeartRate", k -> new ArrayList<>())
                        .add(Map.of("timestamp", ts.toString(), "value", value));
            }
        }
    }

    private Double toDouble(Object value) {
        if (value == null) {
            return null;
        }
        String text = value.toString().trim();
        if (text.isEmpty() || "--".equals(text)) {
            return null;
        }
        if (value instanceof Number n) {
            return n.doubleValue();
        }
        try {
            return Double.parseDouble(text);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private Instant parseInstant(Object ts) {
        if (ts instanceof Date d) {
            return d.toInstant();
        }
        if (ts instanceof Instant i) {
            return i;
        }
        try {
            return Instant.parse(ts.toString());
        } catch (Exception e) {
            return null;
        }
    }

    private String firstNonBlank(Object a, Object b) {
        if (a != null && !a.toString().isBlank()) {
            return a.toString();
        }
        if (b != null && !b.toString().isBlank()) {
            return b.toString();
        }
        return null;
    }
}
