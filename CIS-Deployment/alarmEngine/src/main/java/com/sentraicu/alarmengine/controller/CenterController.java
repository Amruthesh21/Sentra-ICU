package com.sentraicu.alarmengine.controller;

import com.sentraicu.alarmengine.auth.security.AuthSecurity;
import com.sentraicu.alarmengine.auth.service.HospitalContextService;
import com.sentraicu.alarmengine.service.CenterAdminService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/center")
public class CenterController {

    private final CenterAdminService centerAdminService;
    private final HospitalContextService hospitalContextService;
    private final AuthSecurity authSecurity;

    public CenterController(
            CenterAdminService centerAdminService,
            HospitalContextService hospitalContextService,
            AuthSecurity authSecurity) {
        this.centerAdminService = centerAdminService;
        this.hospitalContextService = hospitalContextService;
        this.authSecurity = authSecurity;
    }

    @GetMapping
    public Map<String, Object> getCenter(HttpServletRequest request) {
        return centerAdminService.getCenterOverview(hospitalContextService.resolveCenterId(request));
    }

    // Device/infrastructure config changes — hospital-admin only. Previously
    // reachable by any authenticated clinical account.
    @PostMapping("/beds")
    public ResponseEntity<Map<String, Object>> addBed(
            @RequestBody Map<String, Object> request,
            HttpServletRequest httpRequest) {
        authSecurity.requireHospitalAdmin(httpRequest);
        String bedLabel = (String) request.get("bedLabel");
        String ip = (String) request.get("ip");
        String centerId = hospitalContextService.resolveCenterId(httpRequest);
        return ResponseEntity.ok(centerAdminService.addBed(bedLabel, ip, centerId));
    }

    @PutMapping("/beds")
    public ResponseEntity<Map<String, Object>> updateBed(
            @RequestBody Map<String, Object> request,
            HttpServletRequest httpRequest) {
        authSecurity.requireHospitalAdmin(httpRequest);
        String bedLabel = (String) request.get("bedLabel");
        String ip = (String) request.get("ip");
        String centerId = hospitalContextService.resolveCenterId(httpRequest);
        return ResponseEntity.ok(centerAdminService.updateBedIp(bedLabel, ip, centerId));
    }
}
