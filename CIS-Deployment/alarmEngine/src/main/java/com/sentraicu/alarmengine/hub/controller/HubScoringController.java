package com.sentraicu.alarmengine.hub.controller;

import com.sentraicu.alarmengine.auth.service.HospitalContextService;
import com.sentraicu.alarmengine.hub.service.HubScoringService;
import jakarta.servlet.http.HttpServletRequest;
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
    private final HospitalContextService hospitalContextService;

    public HubScoringController(HubScoringService scoringService, HospitalContextService hospitalContextService) {
        this.scoringService = scoringService;
        this.hospitalContextService = hospitalContextService;
    }

    @GetMapping("/types")
    public List<String> scoreTypes() {
        return scoringService.scoreTypes();
    }

    @GetMapping("/dashboard")
    public List<Map<String, Object>> dashboard(HttpServletRequest request) {
        return scoringService.getDashboard(hospitalContextService.resolveCenterId(request));
    }

    @GetMapping("/visits/{visitId}/autofill")
    public Map<String, Object> autofill(@PathVariable UUID visitId,
                                        @RequestParam String scoreType,
                                        HttpServletRequest request) {
        hospitalContextService.assertVisitInCenter(request, visitId);
        return scoringService.autofill(visitId, scoreType);
    }

    @PostMapping("/visits/{visitId}/preview")
    public ResponseEntity<Map<String, Object>> preview(@PathVariable UUID visitId,
                                                       @RequestParam String scoreType,
                                                       @RequestBody Map<String, Object> body,
                                                       HttpServletRequest request) {
        hospitalContextService.assertVisitInCenter(request, visitId);
        return ResponseEntity.ok(scoringService.preview(visitId, scoreType, body));
    }

    @PostMapping("/visits/{visitId}/save")
    public ResponseEntity<Map<String, Object>> save(@PathVariable UUID visitId,
                                                    @RequestParam String scoreType,
                                                    @RequestBody Map<String, Object> body,
                                                    HttpServletRequest request) {
        hospitalContextService.assertVisitInCenter(request, visitId);
        return ResponseEntity.ok(scoringService.save(visitId, scoreType, body));
    }

    @GetMapping("/visits/{visitId}/history")
    public List<Map<String, Object>> history(@PathVariable UUID visitId,
                                             @RequestParam String scoreType,
                                             @RequestParam(required = false) String from,
                                             HttpServletRequest request) {
        hospitalContextService.assertVisitInCenter(request, visitId);
        Instant fromInstant = from != null && !from.isBlank() ? Instant.parse(from) : null;
        return scoringService.getHistory(visitId, scoreType, fromInstant);
    }
}
