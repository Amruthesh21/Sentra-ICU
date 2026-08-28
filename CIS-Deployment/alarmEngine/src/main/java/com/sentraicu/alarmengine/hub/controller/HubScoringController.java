package com.sentraicu.alarmengine.hub.controller;

import com.sentraicu.alarmengine.hub.service.HubScoringService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/hub/scoring")
public class HubScoringController {

    private final HubScoringService scoringService;

    public HubScoringController(HubScoringService scoringService) {
        this.scoringService = scoringService;
    }

    @GetMapping("/types")
    public List<String> scoreTypes() {
        return scoringService.scoreTypes();
    }

    @GetMapping("/dashboard")
    public List<Map<String, Object>> dashboard() {
        return scoringService.getDashboard();
    }

    @GetMapping("/visits/{visitId}/autofill")
    public Map<String, Object> autofill(@PathVariable UUID visitId,
                                        @RequestParam String scoreType) {
        return scoringService.autofill(visitId, scoreType);
    }

    @PostMapping("/visits/{visitId}/preview")
    public ResponseEntity<Map<String, Object>> preview(@PathVariable UUID visitId,
                                                       @RequestParam String scoreType,
                                                       @RequestBody Map<String, Object> request) {
        return ResponseEntity.ok(scoringService.preview(visitId, scoreType, request));
    }

    @PostMapping("/visits/{visitId}/save")
    public ResponseEntity<Map<String, Object>> save(@PathVariable UUID visitId,
                                                    @RequestParam String scoreType,
                                                    @RequestBody Map<String, Object> request) {
        return ResponseEntity.ok(scoringService.save(visitId, scoreType, request));
    }

    @GetMapping("/visits/{visitId}/history")
    public List<Map<String, Object>> history(@PathVariable UUID visitId,
                                             @RequestParam String scoreType,
                                             @RequestParam(required = false) String from) {
        Instant fromInstant = from != null && !from.isBlank() ? Instant.parse(from) : null;
        return scoringService.getHistory(visitId, scoreType, fromInstant);
    }
}
