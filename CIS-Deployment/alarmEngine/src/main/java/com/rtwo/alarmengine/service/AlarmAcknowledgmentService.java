package com.rtwo.alarmengine.service;

import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AlarmAcknowledgmentService {

    private final Set<String> acknowledged = ConcurrentHashMap.newKeySet();
    private final Map<String, AckState> ackStates = new ConcurrentHashMap<>();

    public static String key(String bedId, String paramName, String threshold) {
        return bedId + "|" + paramName + "|" + threshold;
    }

    public void acknowledge(String bedId, String paramName, String threshold, double valueAtAck) {
        String alarmKey = key(bedId, paramName, threshold);
        acknowledged.add(alarmKey);
        ackStates.put(alarmKey, new AckState(valueAtAck, Instant.now()));
    }

    public boolean isAcknowledged(String bedId, String paramName, String threshold) {
        return acknowledged.contains(key(bedId, paramName, threshold));
    }

    public Instant getAcknowledgedAt(String bedId, String paramName, String threshold) {
        AckState state = ackStates.get(key(bedId, paramName, threshold));
        return state != null ? state.ackTime() : null;
    }

    public boolean shouldEscalate(String bedId, String paramName, String threshold, double currentValue) {
        AckState state = ackStates.get(key(bedId, paramName, threshold));
        if (state == null) {
            return false;
        }
        double delta = escalationDelta(paramName, threshold, state.valueAtAck());
        if ("LOW".equals(threshold)) {
            return currentValue < state.valueAtAck() - delta;
        }
        if ("HIGH".equals(threshold)) {
            return currentValue > state.valueAtAck() + delta;
        }
        return false;
    }

    public void clear(String bedId, String paramName, String threshold) {
        String alarmKey = key(bedId, paramName, threshold);
        acknowledged.remove(alarmKey);
        ackStates.remove(alarmKey);
    }

    public void clearAllForParam(String bedId, String paramName) {
        String prefix = bedId + "|" + paramName + "|";
        acknowledged.removeIf(k -> k.startsWith(prefix));
        ackStates.keySet().removeIf(k -> k.startsWith(prefix));
    }

    public void rearmBed(String bedId) {
        String prefix = bedId + "|";
        acknowledged.removeIf(k -> k.startsWith(prefix));
        ackStates.keySet().removeIf(k -> k.startsWith(prefix));
    }

    private double escalationDelta(String paramName, String threshold, double valueAtAck) {
        if ("SpO2".equalsIgnoreCase(paramName)) {
            return 2.0;
        }
        if ("Temp1".equalsIgnoreCase(paramName)) {
            return 0.3;
        }
        if ("HeartRate".equalsIgnoreCase(paramName) || "Pulse".equalsIgnoreCase(paramName)) {
            return "LOW".equals(threshold) ? 5.0 : 10.0;
        }
        return Math.max(1.0, Math.abs(valueAtAck) * 0.05);
    }

    private record AckState(double valueAtAck, Instant ackTime) {}
}
