package com.rtwo.alarmengine.hub.controller;

import com.rtwo.alarmengine.auth.service.HospitalContextService;
import com.rtwo.alarmengine.hub.service.HubAnalyticsService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/hub/analytics")
public class HubAnalyticsController {

    private final HubAnalyticsService analyticsService;
    private final HospitalContextService hospitalContextService;

    public HubAnalyticsController(
            HubAnalyticsService analyticsService,
            HospitalContextService hospitalContextService) {
        this.analyticsService = analyticsService;
        this.hospitalContextService = hospitalContextService;
    }

    @GetMapping("/center")
    public Map<String, Object> centerAnalytics(HttpServletRequest request) {
        return analyticsService.getCenterAnalytics(hospitalContextService.resolveCenterId(request));
    }
}
