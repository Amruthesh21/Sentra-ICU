package com.rtwo.alarmengine.controller;

import com.rtwo.alarmengine.service.VitalsHistoryService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/vitals/history")
public class VitalsHistoryController {

    private final VitalsHistoryService vitalsHistoryService;

    public VitalsHistoryController(VitalsHistoryService vitalsHistoryService) {
        this.vitalsHistoryService = vitalsHistoryService;
    }

    @GetMapping("/{bedId}")
    public Map<String, Object> history(@PathVariable String bedId,
                                       @RequestParam(defaultValue = "60") int minutes) {
        return vitalsHistoryService.getTrendHistory(bedId, minutes);
    }
}
