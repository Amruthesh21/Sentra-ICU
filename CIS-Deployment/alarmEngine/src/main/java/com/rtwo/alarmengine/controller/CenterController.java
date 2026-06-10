package com.rtwo.alarmengine.controller;

import com.rtwo.alarmengine.service.BedDeviceService;
import com.rtwo.alarmengine.service.CenterAdminService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/center")
public class CenterController {

    private final CenterAdminService centerAdminService;
    private final BedDeviceService bedDeviceService;

    public CenterController(CenterAdminService centerAdminService, BedDeviceService bedDeviceService) {
        this.centerAdminService = centerAdminService;
        this.bedDeviceService = bedDeviceService;
    }

    @GetMapping
    public Map<String, Object> getCenter() {
        return centerAdminService.getCenterOverview();
    }

    @PostMapping("/beds")
    public ResponseEntity<Map<String, Object>> addBed(@RequestBody Map<String, Object> request) {
        String bedLabel = (String) request.get("bedLabel");
        String ip = (String) request.get("ip");
        return ResponseEntity.ok(centerAdminService.addBed(bedLabel, ip));
    }

    @PutMapping("/beds")
    public ResponseEntity<Map<String, Object>> updateBed(@RequestBody Map<String, Object> request) {
        String bedLabel = (String) request.get("bedLabel");
        String ip = (String) request.get("ip");
        return ResponseEntity.ok(centerAdminService.updateBedIp(bedLabel, ip));
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
