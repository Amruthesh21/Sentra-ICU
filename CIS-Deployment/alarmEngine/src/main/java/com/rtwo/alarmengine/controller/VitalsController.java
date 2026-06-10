package com.rtwo.alarmengine.controller;

import com.rtwo.alarmengine.service.VitalsReadService;
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

    public VitalsController(VitalsReadService vitalsReadService) {
        this.vitalsReadService = vitalsReadService;
    }

    @GetMapping("/latest")
    public ResponseEntity<Map<String, Object>> latestByQuery(@RequestParam String bedId) {
        return ResponseEntity.ok(vitalsReadService.getLatestVitals(bedId));
    }

    @GetMapping("/latest/{bedId}")
    public ResponseEntity<Map<String, Object>> latest(@PathVariable String bedId) {
        return ResponseEntity.ok(vitalsReadService.getLatestVitals(bedId));
    }
}
