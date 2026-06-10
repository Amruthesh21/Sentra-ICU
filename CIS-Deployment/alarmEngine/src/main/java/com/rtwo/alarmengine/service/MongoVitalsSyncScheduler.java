package com.rtwo.alarmengine.service;

import com.rtwo.alarmengine.dto.DeviceDataMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
@EnableScheduling
public class MongoVitalsSyncScheduler {

    private static final Logger log = LoggerFactory.getLogger(MongoVitalsSyncScheduler.class);

    private final VitalsReadService vitalsReadService;
    private final LatestVitalsStore latestVitalsStore;
    private final AlarmCheckService alarmCheckService;
    private final VitalTrendBufferService trendBufferService;
    private final OccupiedBedService occupiedBedService;
    private final BedDeviceService bedDeviceService;
    private final BedVirtualVitalsService bedVirtualVitalsService;

    public MongoVitalsSyncScheduler(VitalsReadService vitalsReadService,
                                    LatestVitalsStore latestVitalsStore,
                                    AlarmCheckService alarmCheckService,
                                    VitalTrendBufferService trendBufferService,
                                    OccupiedBedService occupiedBedService,
                                    BedDeviceService bedDeviceService,
                                    BedVirtualVitalsService bedVirtualVitalsService) {
        this.vitalsReadService = vitalsReadService;
        this.latestVitalsStore = latestVitalsStore;
        this.alarmCheckService = alarmCheckService;
        this.trendBufferService = trendBufferService;
        this.occupiedBedService = occupiedBedService;
        this.bedDeviceService = bedDeviceService;
        this.bedVirtualVitalsService = bedVirtualVitalsService;
    }

    @Scheduled(fixedRate = 2000)
    public void syncFromMongo() {
        Set<String> bedIds = new LinkedHashSet<>(occupiedBedService.listMonitoredBedIds());
        for (String bedId : bedIds) {
            try {
                DeviceDataMessage message = loadMessageForBed(bedId);
                if (message == null || message.getPrimaryAttributes() == null || message.getPrimaryAttributes().isEmpty()) {
                    continue;
                }
                latestVitalsStore.put(message);
                trendBufferService.record(bedId, message);
                alarmCheckService.processVitals(message);
            } catch (Exception e) {
                log.debug("Mongo vitals sync skipped for {}: {}", bedId, e.getMessage());
            }
        }
    }

    private DeviceDataMessage loadMessageForBed(String bedId) {
        Map<String, Object> merged = vitalsReadService.loadMergedVitalsFromMongo(bedId);
        if (merged == null || merged.isEmpty()) {
            String bedLabel = bedDeviceService.resolveBedLabel(bedId);
            if (bedDeviceService.isLiveSimulatorBed(bedLabel)) {
                merged = vitalsReadService.loadVitalsByBedDevices(bedId);
            } else if (bedDeviceService.isVirtualSimulatorBed(bedLabel)) {
                merged = bedVirtualVitalsService.generateForBed(bedId);
            }
        }
        if (merged == null || merged.isEmpty()) {
            return null;
        }
        return vitalsReadService.toDeviceDataMessage(bedId, merged);
    }
}
