package com.sentraicu.alarmengine.controller;

import com.sentraicu.alarmengine.auth.service.HospitalContextService;
import com.sentraicu.alarmengine.dto.AcknowledgeAlarmRequest;
import com.sentraicu.alarmengine.dto.AlarmEvent;
import com.sentraicu.alarmengine.service.ActiveAlarmStore;
import jakarta.servlet.http.HttpServletRequest;
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
    private final HospitalContextService hospitalContextService;

    public ActiveAlarmController(ActiveAlarmStore activeAlarmStore, HospitalContextService hospitalContextService) {
        this.activeAlarmStore = activeAlarmStore;
        this.hospitalContextService = hospitalContextService;
    }

    @GetMapping("/active")
    public List<AlarmEvent> getActiveAlarms(HttpServletRequest request) {
        String centerId = hospitalContextService.resolveCenterId(request);
        return activeAlarmStore.getActiveAlarms().stream()
                .filter(event -> hospitalContextService.bedInCenter(centerId, event.getBedId()))
                .toList();
    }

    @GetMapping("/feed")
    public List<Map<String, Object>> getAlarmFeed(HttpServletRequest request) {
        String centerId = hospitalContextService.resolveCenterId(request);
        return activeAlarmStore.getAlarmFeed().stream()
                .filter(row -> hospitalContextService.bedInCenter(centerId, String.valueOf(row.get("bedId"))))
                .toList();
    }

    @PostMapping("/acknowledge")
    public ResponseEntity<Map<String, Object>> acknowledge(@RequestBody AcknowledgeAlarmRequest body,
                                                           HttpServletRequest request) {
        if (body.getBedId() == null || body.getParamName() == null || body.getThreshold() == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "acknowledged", false,
                    "error", "bedId, paramName, and threshold are required"
            ));
        }
        hospitalContextService.assertBedInCenter(request, body.getBedId());
        activeAlarmStore.acknowledge(
                body.getBedId(),
                body.getParamName(),
                body.getThreshold(),
                body.getCurrentValue()
        );
        return ResponseEntity.ok(Map.of(
                "acknowledged", true,
                "bedId", body.getBedId(),
                "paramName", body.getParamName(),
                "threshold", body.getThreshold(),
                "message", "Alarm acknowledged. You will be alerted again if vitals worsen or return to normal then breach limits."
        ));
    }
}
