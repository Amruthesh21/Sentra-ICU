package com.rtwo.alarmengine.hub.controller;

import com.rtwo.alarmengine.auth.service.HospitalContextService;
import com.rtwo.alarmengine.hub.service.HubOverviewService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/hub/overview")
public class HubOverviewController {

    private final HubOverviewService overviewService;
    private final HospitalContextService hospitalContextService;

    public HubOverviewController(
            HubOverviewService overviewService,
            HospitalContextService hospitalContextService) {
        this.overviewService = overviewService;
        this.hospitalContextService = hospitalContextService;
    }

    @GetMapping
    public Map<String, Object> getOverview(HttpServletRequest request) {
        return overviewService.getOverview(hospitalContextService.resolveCenterId(request));
    }
}
