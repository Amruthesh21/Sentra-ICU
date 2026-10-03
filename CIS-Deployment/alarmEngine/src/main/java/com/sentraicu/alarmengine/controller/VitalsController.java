package com.sentraicu.alarmengine.controller;

import com.sentraicu.alarmengine.auth.service.HospitalContextService;
import com.sentraicu.alarmengine.service.VitalsReadService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/vitals")
public class VitalsController {

    private final VitalsReadService vitalsReadService;
    private final HospitalContextService hospitalContextService;

    public VitalsController(VitalsReadService vitalsReadService, HospitalContextService hospitalContextService) {
        this.vitalsReadService = vitalsReadService;
        this.hospitalContextService = hospitalContextService;
    }

    @GetMapping("/latest")
    public ResponseEntity<Map<String, Object>> latestByQuery(@RequestParam String bedId, HttpServletRequest request) {
        hospitalContextService.assertBedInCenter(request, bedId);
        return ResponseEntity.ok(vitalsReadService.getLatestVitals(bedId));
    }

    @GetMapping("/latest/{bedId}")
    public ResponseEntity<Map<String, Object>> latest(@PathVariable String bedId, HttpServletRequest request) {
        hospitalContextService.assertBedInCenter(request, bedId);
        return ResponseEntity.ok(vitalsReadService.getLatestVitals(bedId));
    }
}
