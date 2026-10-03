package com.sentraicu.alarmengine.hub.controller;

import com.sentraicu.alarmengine.auth.service.HospitalContextService;
import com.sentraicu.alarmengine.hub.service.HubFluidService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/hub/clinical")
public class HubFluidController {

    private final HubFluidService fluidService;
    private final HospitalContextService hospitalContextService;

    public HubFluidController(HubFluidService fluidService, HospitalContextService hospitalContextService) {
        this.fluidService = fluidService;
        this.hospitalContextService = hospitalContextService;
    }

    @GetMapping("/visits/{visitId}/fluids")
    public List<Map<String, Object>> listFluids(
            @PathVariable UUID visitId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            HttpServletRequest request) {
        hospitalContextService.assertVisitInCenter(request, visitId);
        Instant fromInstant = from != null ? Instant.parse(from) : Instant.EPOCH;
        Instant toInstant = to != null ? Instant.parse(to) : Instant.now();
        return fluidService.listForVisit(visitId, fromInstant, toInstant);
    }

    @PostMapping("/visits/{visitId}/fluids")
    public ResponseEntity<Map<String, Object>> createFluid(
            @PathVariable UUID visitId,
            @RequestBody Map<String, Object> body,
            HttpServletRequest request) {
        hospitalContextService.assertVisitInCenter(request, visitId);
        return ResponseEntity.ok(fluidService.create(visitId, body));
    }

    @DeleteMapping("/fluids/{entryId}")
    public ResponseEntity<Void> deleteFluid(@PathVariable UUID entryId, HttpServletRequest request) {
        hospitalContextService.assertVisitInCenter(request, fluidService.visitIdForEntry(entryId));
        fluidService.delete(entryId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/fluids/{entryId}/stop")
    public ResponseEntity<Map<String, Object>> stopRunningFluid(@PathVariable UUID entryId,
                                                                HttpServletRequest request) {
        hospitalContextService.assertVisitInCenter(request, fluidService.visitIdForEntry(entryId));
        return ResponseEntity.ok(fluidService.stopRunning(entryId));
    }
}
