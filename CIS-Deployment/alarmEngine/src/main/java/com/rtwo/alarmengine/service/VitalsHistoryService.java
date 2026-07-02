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
        Instant to = Instant.now();
        Instant from = to.minus(minutes, ChronoUnit.MINUTES);
        return getTrendHistory(bedId, from, to, true);
    }

    public Map<String, Object> getTrendHistory(String bedId, Instant from, Instant to, boolean includeLiveBuffer) {
        if (from == null || to == null) {
            return getTrendHistory(bedId, 60);
        }
        if (from.isAfter(to)) {
            Instant swap = from;
            from = to;
            to = swap;
        }

        if (cisCenterService.resolvePatientVisitId(bedId) == null && !hasDeviceFallback(bedId)) {
            return rangeResult(bedId, from, to, List.of(), "none");
        }

        Map<String, List<Map<String, Object>>> seriesMap = new LinkedHashMap<>();

        String patientVisitId = cisCenterService.resolvePatientVisitId(bedId);
        if (patientVisitId != null) {
            loadMongoSeries(seriesMap, Criteria.where("metadata.patientId").is(patientVisitId), from, to, "historyVitals");
            loadMongoSeries(seriesMap, Criteria.where("metadata.patientId").is(patientVisitId), from, to, VitalsArchiveService.COLLECTION);
        }

        String normalizedBed = bedDeviceService.resolveBedLabel(bedId);
        if (normalizedBed != null) {
            loadMongoSeries(seriesMap, Criteria.where("bedId").is("ICU-1-" + normalizedBed), from, to, VitalsArchiveService.COLLECTION);
            loadMongoSeries(seriesMap, Criteria.where("metadata.bedId").is("ICU-1-" + normalizedBed), from, to, VitalsArchiveService.COLLECTION);
        }

        if (seriesMap.isEmpty() && hasDeviceFallback(bedId)) {
            String bedLabel = bedDeviceService.resolveBedLabel(bedId);
            if (bedDeviceService.isLiveSimulatorBed(bedLabel)) {
                List<String> deviceIds = bedDeviceService.getBedDeviceIds(bedLabel);
                for (String deviceId : deviceIds) {
                    loadMongoSeries(seriesMap,
                            Criteria.where("metadata.deviceId").is(deviceId),
                            from, to, "historyVitals");
                }
            }
        }

        if (includeLiveBuffer && to.isAfter(Instant.now().minus(2, ChronoUnit.MINUTES))) {
            mergeBufferSeries(seriesMap, trendBufferService.getSeriesForBed(bedId), from, to);
        }

        List<Map<String, Object>> series = buildSeriesList(seriesMap);
        String source = series.isEmpty() ? "none"
                : patientVisitId != null ? "mongodb+archive+buffer" : "device+archive+buffer";
        return rangeResult(bedId, from, to, series, source);
    }

    private boolean hasDeviceFallback(String bedId) {
        String bedLabel = bedDeviceService.resolveBedLabel(bedId);
        return bedDeviceService.isLiveSimulatorBed(bedLabel);
    }

    private Map<String, Object> rangeResult(String bedId, Instant from, Instant to,
                                            List<Map<String, Object>> series, String source) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("bedId", bedId);
        result.put("from", from.toString());
        result.put("to", to.toString());
        result.put("minutes", ChronoUnit.MINUTES.between(from, to));
        result.put("series", series);
        result.put("source", source);
        return result;
    }

    private void loadMongoSeries(Map<String, List<Map<String, Object>>> seriesMap,
                                 Criteria criteria,
                                 Instant from,
                                 Instant to,
                                 String collection) {
        Query query = new Query(criteria.and("timestamp").gte(Date.from(from)).lte(Date.from(to)))
                .with(Sort.by(Sort.Direction.ASC, "timestamp"))
                .limit(12000);
        List<Document> docs = mongoTemplate.find(query, Document.class, collection);
        for (Document doc : docs) {
            Instant ts = parseInstant(doc.get("timestamp"));
            if (ts == null || ts.isBefore(from) || ts.isAfter(to)) {
                continue;
            }
            collectSeries(seriesMap, doc.get("primaryAttributes"), ts);
            collectSeries(seriesMap, doc.get("additionalAttributes"), ts);
            collectSeries(seriesMap, doc.get("secondaryAttributes"), ts);
        }
    }

    @SuppressWarnings("unchecked")
    private void mergeBufferSeries(Map<String, List<Map<String, Object>>> seriesMap,
                                   List<Map<String, Object>> bufferSeries,
                                   Instant from,
                                   Instant to) {
        for (Map<String, Object> entry : bufferSeries) {
            String paramName = String.valueOf(entry.get("paramName"));
            Object pointsObj = entry.get("points");
            if (!(pointsObj instanceof List<?> points)) {
                continue;
            }
            List<Map<String, Object>> target = seriesMap.computeIfAbsent(paramName, k -> new ArrayList<>());
            for (Object p : points) {
                if (p instanceof Map<?, ?> point) {
                    Instant ts = parseInstant(point.get("timestamp"));
                    if (ts == null || ts.isBefore(from) || ts.isAfter(to)) {
                        continue;
                    }
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
