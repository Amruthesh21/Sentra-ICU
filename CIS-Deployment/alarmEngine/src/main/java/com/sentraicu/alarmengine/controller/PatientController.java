package com.sentraicu.alarmengine.controller;

import com.sentraicu.alarmengine.auth.service.HospitalContextService;
import com.sentraicu.alarmengine.service.PatientInfoService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/patients")
public class PatientController {

    private final PatientInfoService patientInfoService;
    private final HospitalContextService hospitalContextService;

    public PatientController(PatientInfoService patientInfoService, HospitalContextService hospitalContextService) {
        this.patientInfoService = patientInfoService;
        this.hospitalContextService = hospitalContextService;
    }

    @GetMapping("/bed/{bedId}")
    public Map<String, Object> getByBed(@PathVariable String bedId, HttpServletRequest request) {
        hospitalContextService.assertBedInCenter(request, bedId);
        return patientInfoService.getPatientByBed(bedId);
    }
}
