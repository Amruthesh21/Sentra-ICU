package com.sentraicu.alarmengine.hub.controller;

import com.sentraicu.alarmengine.auth.service.HospitalContextService;
import com.sentraicu.alarmengine.hub.service.HubReportService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/hub/reports")
public class HubReportController {

    private final HubReportService reportService;
    private final HospitalContextService hospitalContextService;

    public HubReportController(HubReportService reportService, HospitalContextService hospitalContextService) {
        this.reportService = reportService;
        this.hospitalContextService = hospitalContextService;
    }

    @GetMapping("/patients")
    public List<Map<String, Object>> listPatients(@RequestParam(required = false) String unitId,
                                                  @RequestParam(required = false, defaultValue = "false") boolean discharged,
                                                  HttpServletRequest request) {
        String centerId = hospitalContextService.resolveCenterId(request);
        return discharged
                ? reportService.listDischargedPatients(unitId, centerId)
                : reportService.listReportablePatients(unitId, centerId);
    }

    @PostMapping("/generate")
    public ResponseEntity<Map<String, Object>> generate(@RequestBody Map<String, Object> body,
                                                        HttpServletRequest request) {
        Object visitId = body.get("visitId");
        if (visitId != null && !String.valueOf(visitId).isBlank()) {
            hospitalContextService.assertVisitInCenter(request, UUID.fromString(String.valueOf(visitId)));
        }
        return ResponseEntity.ok(reportService.generateReport(body));
    }
}
