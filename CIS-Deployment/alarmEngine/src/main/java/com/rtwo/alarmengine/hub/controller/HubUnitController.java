package com.rtwo.alarmengine.hub.controller;

import com.rtwo.alarmengine.auth.service.HospitalContextService;
import com.rtwo.alarmengine.hub.service.HubUnitAdminService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/hub/units")
public class HubUnitController {

    private final HubUnitAdminService unitAdminService;
    private final HospitalContextService hospitalContextService;

    public HubUnitController(HubUnitAdminService unitAdminService,
                             HospitalContextService hospitalContextService) {
        this.unitAdminService = unitAdminService;
        this.hospitalContextService = hospitalContextService;
    }

    @GetMapping
    public List<Map<String, Object>> listUnits(HttpServletRequest request) {
        return unitAdminService.listUnits(hospitalContextService.resolveCenterId(request));
    }

    @GetMapping("/{unitId}")
    public Map<String, Object> getUnit(@PathVariable UUID unitId, HttpServletRequest request) {
        return unitAdminService.getUnitDetail(unitId, hospitalContextService.resolveCenterId(request));
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> createUnit(@RequestBody Map<String, Object> request,
                                                          HttpServletRequest httpRequest) {
        String centerId = hospitalContextService.resolveCenterId(httpRequest);
        return ResponseEntity.ok(unitAdminService.createUnit(request, centerId));
    }

    @PostMapping("/{unitId}/beds")
    public ResponseEntity<Map<String, Object>> addBed(@PathVariable UUID unitId,
                                                      @RequestBody Map<String, Object> request,
                                                      HttpServletRequest httpRequest) {
        String centerId = hospitalContextService.resolveCenterId(httpRequest);
        return ResponseEntity.ok(unitAdminService.addBedToUnit(unitId, request, centerId));
    }

    @GetMapping("/{unitId}/beds")
    public List<Map<String, Object>> listBeds(@PathVariable UUID unitId, HttpServletRequest request) {
        return unitAdminService.listBedsForUnit(unitId, hospitalContextService.resolveCenterId(request));
    }
}
