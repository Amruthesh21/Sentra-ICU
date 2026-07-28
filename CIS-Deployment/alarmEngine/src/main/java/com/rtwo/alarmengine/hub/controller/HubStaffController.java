package com.rtwo.alarmengine.hub.controller;

import com.rtwo.alarmengine.auth.service.HospitalContextService;
import com.rtwo.alarmengine.hub.service.HubStaffService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/hub/staff")
public class HubStaffController {

    private final HubStaffService staffService;
    private final HospitalContextService hospitalContextService;

    public HubStaffController(HubStaffService staffService, HospitalContextService hospitalContextService) {
        this.staffService = staffService;
        this.hospitalContextService = hospitalContextService;
    }

    @GetMapping
    public List<Map<String, Object>> list(
            @RequestParam(required = false) String role,
            HttpServletRequest request) {
        return staffService.list(hospitalContextService.resolveCenterId(request), role);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> create(
            @RequestBody Map<String, Object> body,
            HttpServletRequest request) {
        return ResponseEntity.ok(staffService.create(body, hospitalContextService.resolveCenterId(request)));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<Map<String, Object>> update(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(staffService.update(id, body));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> deactivate(@PathVariable UUID id) {
        return ResponseEntity.ok(staffService.deactivate(id));
    }
}
