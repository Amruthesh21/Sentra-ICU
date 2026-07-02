package com.rtwo.alarmengine.service;

import com.rtwo.alarmengine.dto.AlarmEvent;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentLinkedDeque;

@Service
public class ActiveAlarmStore {

    private static final int MAX_ALARMS = 200;
    private static final long RETENTION_MINUTES = 30;

    private final Deque<AlarmEvent> alarms = new ConcurrentLinkedDeque<>();
    private final AlarmAcknowledgmentService acknowledgmentService;

    public ActiveAlarmStore(AlarmAcknowledgmentService acknowledgmentService) {
        this.acknowledgmentService = acknowledgmentService;
    }

    public void add(AlarmEvent event) {
        alarms.removeIf(existing -> sameCondition(existing, event));
        alarms.addFirst(event);
        trim();
    }

    public List<AlarmEvent> getActiveAlarms() {
        Instant cutoff = Instant.now().minusSeconds(RETENTION_MINUTES * 60);
        return alarms.stream()
                .filter(a -> a.getTimestamp() != null && a.getTimestamp().isAfter(cutoff))
                .filter(a -> !acknowledgmentService.isAcknowledged(
                        a.getBedId(), a.getParamName(), a.getThreshold()))
                .sorted(Comparator.comparing(AlarmEvent::getTimestamp).reversed())
                .toList();
    }

    /** Recent alarms for hospital alarm center — includes acknowledged within retention window. */
    public List<Map<String, Object>> getAlarmFeed() {
        Instant cutoff = Instant.now().minusSeconds(RETENTION_MINUTES * 60);
        return alarms.stream()
                .filter(a -> a.getTimestamp() != null && a.getTimestamp().isAfter(cutoff))
                .sorted(Comparator.comparing(AlarmEvent::getTimestamp).reversed())
                .map(this::toFeedMap)
                .toList();
    }

    private Map<String, Object> toFeedMap(AlarmEvent a) {
        boolean acked = acknowledgmentService.isAcknowledged(a.getBedId(), a.getParamName(), a.getThreshold());
        Instant ackAt = acknowledgmentService.getAcknowledgedAt(a.getBedId(), a.getParamName(), a.getThreshold());
        Map<String, Object> m = new java.util.LinkedHashMap<>();
        m.put("bedId", a.getBedId());
        m.put("patientName", a.getPatientName());
        m.put("patientMRN", a.getPatientMRN());
        m.put("paramName", a.getParamName());
        m.put("currentValue", a.getCurrentValue());
        m.put("threshold", a.getThreshold());
        m.put("thresholdValue", a.getThresholdValue());
        m.put("severity", a.getSeverity());
        m.put("timestamp", a.getTimestamp() != null ? a.getTimestamp().toString() : null);
        m.put("acknowledged", acked);
        m.put("acknowledgedAt", ackAt != null ? ackAt.toString() : null);
        m.put("title", buildFeedTitle(a));
        return m;
    }

    private String buildFeedTitle(AlarmEvent a) {
        String param = a.getParamName() != null ? a.getParamName() : "Alarm";
        if ("LOW".equals(a.getThreshold())) return param + " below limit";
        if ("HIGH".equals(a.getThreshold())) return param + " above limit";
        return param + " alarm";
    }

    public void acknowledge(String bedId, String paramName, String threshold, Double valueAtAck) {
        double ackValue = valueAtAck != null ? valueAtAck : 0.0;
        acknowledgmentService.acknowledge(bedId, paramName, threshold, ackValue);
    }

    public void clearForParam(String bedId, String paramName) {
        acknowledgmentService.clearAllForParam(bedId, paramName);
        alarms.removeIf(a -> bedId.equals(a.getBedId()) && paramName.equals(a.getParamName()));
    }

    public void rearmBed(String bedId) {
        acknowledgmentService.rearmBed(bedId);
        alarms.removeIf(a -> bedId.equals(a.getBedId()));
    }

    private boolean sameCondition(AlarmEvent a, AlarmEvent b) {
        return a.getBedId() != null && a.getBedId().equals(b.getBedId())
                && a.getParamName() != null && a.getParamName().equals(b.getParamName())
                && a.getThreshold() != null && a.getThreshold().equals(b.getThreshold());
    }

    private void trim() {
        while (alarms.size() > MAX_ALARMS) {
            alarms.removeLast();
        }
        Instant cutoff = Instant.now().minusSeconds(RETENTION_MINUTES * 60);
        alarms.removeIf(a -> a.getTimestamp() != null && a.getTimestamp().isBefore(cutoff));
    }
}
