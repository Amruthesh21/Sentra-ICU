package com.rtwo.alarmengine.service;

import com.rtwo.alarmengine.dto.DeviceDataMessage;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class LatestVitalsStore {

    private final Map<String, DeviceDataMessage> latestByBed = new ConcurrentHashMap<>();

    public void put(DeviceDataMessage deviceData) {
        if (deviceData != null && deviceData.getBedId() != null) {
            latestByBed.put(deviceData.getBedId(), deviceData);
        }
    }

    public void putFromRabbit(DeviceDataMessage deviceData) {
        put(deviceData);
    }

    public DeviceDataMessage get(String bedId) {
        return latestByBed.get(bedId);
    }
}
