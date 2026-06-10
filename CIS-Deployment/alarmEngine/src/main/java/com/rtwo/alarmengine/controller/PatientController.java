package com.rtwo.alarmengine.controller;

import com.rtwo.alarmengine.service.PatientInfoService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/patients")
public class PatientController {

    private final PatientInfoService patientInfoService;

    public PatientController(PatientInfoService patientInfoService) {
        this.patientInfoService = patientInfoService;
    }

    @GetMapping("/bed/{bedId}")
    public Map<String, Object> getByBed(@PathVariable String bedId) {
        return patientInfoService.getPatientByBed(bedId);
    }

    @GetMapping
    public List<Map<String, Object>> listByDoctor(@RequestParam(defaultValue = "doctor-001") String doctorId) {
        return patientInfoService.listPatientsForDoctor(doctorId);
    }
}
