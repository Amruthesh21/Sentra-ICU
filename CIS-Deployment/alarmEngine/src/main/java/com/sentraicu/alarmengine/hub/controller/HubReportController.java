package com.sentraicu.alarmengine.hub.controller;

import com.sentraicu.alarmengine.hub.service.HubReportService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/hub/reports")
public class HubReportController {

    private final HubReportService reportService;

    public HubReportController(HubReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping("/patients")
    public List<Map<String, Object>> listPatients(@RequestParam(required = false) String unitId,
                                                  @RequestParam(required = false, defaultValue = "false") boolean discharged) {
        return discharged
                ? reportService.listDischargedPatients(unitId)
                : reportService.listReportablePatients(unitId);
    }

    @PostMapping("/generate")
    public ResponseEntity<Map<String, Object>> generate(@RequestBody Map<String, Object> request) {
        return ResponseEntity.ok(reportService.generateReport(request));
    }
}
