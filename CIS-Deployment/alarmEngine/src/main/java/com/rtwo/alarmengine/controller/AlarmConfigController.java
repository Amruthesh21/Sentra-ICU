package com.rtwo.alarmengine.controller;

import com.rtwo.alarmengine.dto.AlarmConfigRequest;
import com.rtwo.alarmengine.entity.DoctorAlarmConfig;
import com.rtwo.alarmengine.service.AlarmConfigService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/alarm-config")
public class AlarmConfigController {

    private final AlarmConfigService alarmConfigService;

    public AlarmConfigController(AlarmConfigService alarmConfigService) {
        this.alarmConfigService = alarmConfigService;
    }

    @PostMapping
    public ResponseEntity<DoctorAlarmConfig> createOrUpdate(@RequestBody AlarmConfigRequest request) {
        return ResponseEntity.ok(alarmConfigService.saveOrUpdate(request));
    }

    @GetMapping("/{doctorId}")
    public ResponseEntity<List<DoctorAlarmConfig>> getByDoctor(@PathVariable String doctorId) {
        return ResponseEntity.ok(alarmConfigService.getByDoctorId(doctorId));
    }

    @DeleteMapping("/{doctorId}/{bedId}")
    public ResponseEntity<Void> delete(@PathVariable String doctorId, @PathVariable String bedId) {
        alarmConfigService.delete(doctorId, bedId);
        return ResponseEntity.noContent().build();
    }
}
