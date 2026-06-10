package com.rtwo.alarmengine.controller;

import com.rtwo.alarmengine.service.PatientAdminService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/patients")
public class PatientAdminController {

    private final PatientAdminService patientAdminService;

    public PatientAdminController(PatientAdminService patientAdminService) {
        this.patientAdminService = patientAdminService;
    }

    @PostMapping("/admit")
    public ResponseEntity<Map<String, Object>> admit(@RequestBody Map<String, Object> request) {
        String bedLabel = (String) request.get("bedLabel");
        return ResponseEntity.ok(patientAdminService.admitPatient(bedLabel, request));
    }

    @PostMapping("/discharge")
    public ResponseEntity<Map<String, Object>> discharge(@RequestBody Map<String, Object> request) {
        String bedLabel = (String) request.get("bedLabel");
        return ResponseEntity.ok(patientAdminService.dischargePatient(bedLabel));
    }
}
