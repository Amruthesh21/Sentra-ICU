package com.sentraicu.alarmengine.service;

import com.sentraicu.alarmengine.dto.DeviceDataMessage;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class LatestVitalsStore {

    private final Map<String, DeviceDataMessage> latestByBed = new ConcurrentHashMap<>();

    public void put(DeviceDataMessage deviceData) {
        if (deviceData != null && deviceData.getBedId() != null) {
            String canonical = BedIdUtil.canonicalAlarmBedId(deviceData.getBedId());
            deviceData.setBedId(canonical);
            latestByBed.put(canonical, deviceData);
        }
    }

    public void putFromRabbit(DeviceDataMessage deviceData) {
        put(deviceData);
    }

    public DeviceDataMessage get(String bedId) {
        if (bedId == null) {
            return null;
        }
        String canonical = BedIdUtil.canonicalAlarmBedId(bedId);
        DeviceDataMessage direct = latestByBed.get(canonical);
        if (direct != null) {
            return direct;
        }
        for (String variant : VitalsReadService.bedIdVariants(bedId)) {
            direct = latestByBed.get(BedIdUtil.canonicalAlarmBedId(variant));
            if (direct != null) {
                return direct;
            }
        }
        return latestByBed.get(bedId);
    }
}
