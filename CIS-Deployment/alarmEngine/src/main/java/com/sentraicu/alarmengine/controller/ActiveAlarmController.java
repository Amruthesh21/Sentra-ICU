package com.sentraicu.alarmengine.controller;

import com.sentraicu.alarmengine.dto.AcknowledgeAlarmRequest;
import com.sentraicu.alarmengine.dto.AlarmEvent;
import com.sentraicu.alarmengine.service.ActiveAlarmStore;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/alarm")
public class ActiveAlarmController {

    private final ActiveAlarmStore activeAlarmStore;

    public ActiveAlarmController(ActiveAlarmStore activeAlarmStore) {
        this.activeAlarmStore = activeAlarmStore;
    }

    @GetMapping("/active")
    public List<AlarmEvent> getActiveAlarms() {
        return activeAlarmStore.getActiveAlarms();
    }

    @GetMapping("/feed")
    public List<Map<String, Object>> getAlarmFeed() {
        return activeAlarmStore.getAlarmFeed();
    }

    @PostMapping("/acknowledge")
    public ResponseEntity<Map<String, Object>> acknowledge(@RequestBody AcknowledgeAlarmRequest request) {
        if (request.getBedId() == null || request.getParamName() == null || request.getThreshold() == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "acknowledged", false,
                    "error", "bedId, paramName, and threshold are required"
            ));
        }
        activeAlarmStore.acknowledge(
                request.getBedId(),
                request.getParamName(),
                request.getThreshold(),
                request.getCurrentValue()
        );
        return ResponseEntity.ok(Map.of(
                "acknowledged", true,
                "bedId", request.getBedId(),
                "paramName", request.getParamName(),
                "threshold", request.getThreshold(),
                "message", "Alarm acknowledged. You will be alerted again if vitals worsen or return to normal then breach limits."
        ));
    }
}
