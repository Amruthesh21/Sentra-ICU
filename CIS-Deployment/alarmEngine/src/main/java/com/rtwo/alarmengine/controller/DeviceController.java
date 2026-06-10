package com.rtwo.alarmengine.controller;

import com.rtwo.alarmengine.service.DeviceCatalogService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/devices")
public class DeviceController {

    private final DeviceCatalogService deviceCatalogService;

    public DeviceController(DeviceCatalogService deviceCatalogService) {
        this.deviceCatalogService = deviceCatalogService;
    }

    @GetMapping
    public List<Map<String, Object>> listDevices() {
        return deviceCatalogService.listAvailableDevices();
    }
}
