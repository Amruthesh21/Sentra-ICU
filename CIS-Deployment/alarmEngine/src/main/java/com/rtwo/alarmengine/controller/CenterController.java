package com.rtwo.alarmengine.controller;

import com.rtwo.alarmengine.auth.service.HospitalContextService;
import com.rtwo.alarmengine.service.BedDeviceService;
import com.rtwo.alarmengine.service.CenterAdminService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/center")
public class CenterController {

    private final CenterAdminService centerAdminService;
    private final BedDeviceService bedDeviceService;
    private final HospitalContextService hospitalContextService;

    public CenterController(
            CenterAdminService centerAdminService,
            BedDeviceService bedDeviceService,
            HospitalContextService hospitalContextService) {
        this.centerAdminService = centerAdminService;
        this.bedDeviceService = bedDeviceService;
        this.hospitalContextService = hospitalContextService;
    }

    @GetMapping
    public Map<String, Object> getCenter(HttpServletRequest request) {
        return centerAdminService.getCenterOverview(hospitalContextService.resolveCenterId(request));
    }

    @PostMapping("/beds")
    public ResponseEntity<Map<String, Object>> addBed(
            @RequestBody Map<String, Object> request,
            HttpServletRequest httpRequest) {
        String bedLabel = (String) request.get("bedLabel");
        String ip = (String) request.get("ip");
        String centerId = hospitalContextService.resolveCenterId(httpRequest);
        return ResponseEntity.ok(centerAdminService.addBed(bedLabel, ip, centerId));
    }

    @PutMapping("/beds")
    public ResponseEntity<Map<String, Object>> updateBed(
            @RequestBody Map<String, Object> request,
            HttpServletRequest httpRequest) {
        String bedLabel = (String) request.get("bedLabel");
        String ip = (String) request.get("ip");
        String centerId = hospitalContextService.resolveCenterId(httpRequest);
        return ResponseEntity.ok(centerAdminService.updateBedIp(bedLabel, ip, centerId));
    }

    @PostMapping("/reload")
    public ResponseEntity<Map<String, Object>> reloadConnectEngine() {
        return ResponseEntity.ok(centerAdminService.reloadConnectEngine());
    }

    @GetMapping("/beds/{bedLabel}/devices")
    public Map<String, Object> bedDevices(@PathVariable String bedLabel) {
        return bedDeviceService.getBedDeviceStatus("ICU-1-" + bedLabel);
    }
}
