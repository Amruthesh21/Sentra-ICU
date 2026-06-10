package com.rtwo.alarmengine.service;

import com.rtwo.alarmengine.dto.AlarmEvent;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.List;
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

    public void acknowledge(String bedId, String paramName, String threshold, Double valueAtAck) {
        double ackValue = valueAtAck != null ? valueAtAck : 0.0;
        acknowledgmentService.acknowledge(bedId, paramName, threshold, ackValue);
        alarms.removeIf(a -> bedId.equals(a.getBedId())
                && paramName.equals(a.getParamName())
                && threshold.equals(a.getThreshold()));
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
