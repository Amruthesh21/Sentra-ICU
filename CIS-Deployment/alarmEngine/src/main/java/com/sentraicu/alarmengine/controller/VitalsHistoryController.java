package com.sentraicu.alarmengine.controller;

import com.sentraicu.alarmengine.service.VitalsHistoryService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
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
                                       @RequestParam(defaultValue = "60") int minutes,
                                       @RequestParam(required = false) String from,
                                       @RequestParam(required = false) String to) {
        if (from != null && !from.isBlank() && to != null && !to.isBlank()) {
            Instant fromInstant = Instant.parse(from);
            Instant toInstant = Instant.parse(to);
            boolean live = toInstant.isAfter(Instant.now().minusSeconds(120));
            return vitalsHistoryService.getTrendHistory(bedId, fromInstant, toInstant, live);
        }
        return vitalsHistoryService.getTrendHistory(bedId, minutes);
    }
}
