package com.sentraicu.alarmengine.hub.controller;

import com.sentraicu.alarmengine.auth.service.HospitalContextService;
import com.sentraicu.alarmengine.hub.service.HubAdmissionService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/hub/admissions")
public class HubAdmissionController {

    private final HubAdmissionService admissionService;
    private final HospitalContextService hospitalContextService;

    public HubAdmissionController(
            HubAdmissionService admissionService,
            HospitalContextService hospitalContextService) {
        this.admissionService = admissionService;
        this.hospitalContextService = hospitalContextService;
    }

    @GetMapping("/patients/search")
    public List<Map<String, Object>> searchPatients(@RequestParam String q) {
        return admissionService.searchPatients(q);
    }

    @GetMapping("/beds")
    public List<Map<String, Object>> listBeds(
            @RequestParam(required = false) UUID unitId,
            @RequestParam(required = false, defaultValue = "false") boolean allUnits,
            HttpServletRequest request) {
        return admissionService.listBeds(unitId, allUnits, hospitalContextService.resolveCenterId(request));
    }

    @PostMapping("/draft")
    public ResponseEntity<Map<String, Object>> saveDraft(@RequestBody Map<String, Object> request) {
        return ResponseEntity.ok(admissionService.saveDraft(request));
    }

    @PostMapping("/admit")
    public ResponseEntity<Map<String, Object>> admit(
            @RequestBody Map<String, Object> request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(admissionService.admitNew(request, hospitalContextService.resolveCenterId(httpRequest)));
    }

    @PostMapping("/readmit")
    public ResponseEntity<Map<String, Object>> readmit(
            @RequestBody Map<String, Object> request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(admissionService.readmit(request, hospitalContextService.resolveCenterId(httpRequest)));
    }

    @GetMapping("/discharge-preview")
    public Map<String, Object> dischargePreview(
            @RequestParam String bedLabel,
            HttpServletRequest request) {
        return admissionService.getDischargePreview(bedLabel, hospitalContextService.resolveCenterId(request));
    }

    @PostMapping("/discharge")
    public ResponseEntity<Map<String, Object>> discharge(
            @RequestBody Map<String, Object> request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(admissionService.discharge(request, hospitalContextService.resolveCenterId(httpRequest)));
    }
}
