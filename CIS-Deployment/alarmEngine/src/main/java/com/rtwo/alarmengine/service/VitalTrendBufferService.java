package com.rtwo.alarmengine.service;

import com.rtwo.alarmengine.dto.DeviceDataMessage;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Rolling in-memory trend buffer — fills gaps when historyVitals is not yet tagged to a new patient visit.
 */
@Service
public class VitalTrendBufferService {

    private static final int MAX_POINTS_PER_PARAM = 180;

    private final Map<String, Map<String, LinkedList<Map<String, Object>>>> buffer = new ConcurrentHashMap<>();

    public void record(String bedId, DeviceDataMessage message) {
        if (bedId == null || message == null) {
            return;
        }
        String normalizedBed = normalizeBedId(bedId);
        // Always stamp with current time so trends build even when source message timestamp is stale.
        String ts = Instant.now().toString();
        Map<String, LinkedList<Map<String, Object>>> bedBuffer =
                buffer.computeIfAbsent(normalizedBed, k -> new ConcurrentHashMap<>());

        appendAttributes(bedBuffer, message.getPrimaryAttributes(), ts);
        appendAttributes(bedBuffer, message.getSecondaryAttributes(), ts);
    }

    public List<Map<String, Object>> getSeriesForBed(String bedId) {
        String normalized = normalizeBedId(bedId);
        Map<String, LinkedList<Map<String, Object>>> bedBuffer = buffer.get(normalized);
        if (bedBuffer == null || bedBuffer.isEmpty()) {
            for (String variant : VitalsReadService.bedIdVariants(bedId)) {
                bedBuffer = buffer.get(normalizeBedId(variant));
                if (bedBuffer != null && !bedBuffer.isEmpty()) {
                    break;
                }
            }
        }
        if (bedBuffer == null || bedBuffer.isEmpty()) {
            return List.of();
        }

        List<Map<String, Object>> series = new ArrayList<>();
        for (Map.Entry<String, LinkedList<Map<String, Object>>> entry : bedBuffer.entrySet()) {
            if (!entry.getValue().isEmpty()) {
                series.add(Map.of(
                        "paramName", entry.getKey(),
                        "points", new ArrayList<>(entry.getValue()),
                        "source", "live-buffer"
                ));
            }
        }
        return series;
    }

    private void appendAttributes(Map<String, LinkedList<Map<String, Object>>> bedBuffer,
                                  List<DeviceDataMessage.VitalAttribute> attributes,
                                  String ts) {
        if (attributes == null) {
            return;
        }
        for (DeviceDataMessage.VitalAttribute attr : attributes) {
            if (attr.getParamName() == null || attr.getValue() == null) {
                continue;
            }
            appendPoint(bedBuffer, attr.getParamName(), ts, attr.getValue());
            if ("Pulse".equalsIgnoreCase(attr.getParamName())) {
                appendPoint(bedBuffer, "HeartRate", ts, attr.getValue());
            }
            if ("Heart Rate".equalsIgnoreCase(attr.getParamName())) {
                appendPoint(bedBuffer, "HeartRate", ts, attr.getValue());
            }
        }
    }

    private void appendPoint(Map<String, LinkedList<Map<String, Object>>> bedBuffer,
                             String paramName,
                             String ts,
                             Double value) {
        LinkedList<Map<String, Object>> points = bedBuffer.computeIfAbsent(paramName, k -> new LinkedList<>());
        if (!points.isEmpty()) {
            Map<String, Object> last = points.getLast();
            if (ts.equals(String.valueOf(last.get("timestamp")))) {
                points.removeLast();
            }
        }
        points.add(Map.of("timestamp", ts, "value", value));
        while (points.size() > MAX_POINTS_PER_PARAM) {
            points.removeFirst();
        }
    }

    private String normalizeBedId(String bedId) {
        if (bedId != null && bedId.matches("BED-\\d+")) {
            return "ICU-1-" + bedId;
        }
        return bedId;
    }
}
