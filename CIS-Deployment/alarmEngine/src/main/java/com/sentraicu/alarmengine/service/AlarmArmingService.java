package com.sentraicu.alarmengine.service;

import com.sentraicu.alarmengine.dto.DeviceDataMessage;
import org.springframework.stereotype.Service;

@Service
public class AlarmArmingService {

    private final ActiveAlarmStore activeAlarmStore;
    private final AlarmNotifyStateService notifyStateService;
    private final LatestVitalsStore latestVitalsStore;
    private final AlarmCheckService alarmCheckService;

    public AlarmArmingService(ActiveAlarmStore activeAlarmStore,
                              AlarmNotifyStateService notifyStateService,
                              LatestVitalsStore latestVitalsStore,
                              AlarmCheckService alarmCheckService) {
        this.activeAlarmStore = activeAlarmStore;
        this.notifyStateService = notifyStateService;
        this.latestVitalsStore = latestVitalsStore;
        this.alarmCheckService = alarmCheckService;
    }

    public void rearmBedAndEvaluate(String bedId) {
        String canonical = BedIdUtil.canonicalAlarmBedId(bedId);
        activeAlarmStore.rearmBed(canonical);
        notifyStateService.rearmBed(canonical);

        DeviceDataMessage latest = latestVitalsStore.get(canonical);
        if (latest != null) {
            alarmCheckService.processVitals(latest);
        }
    }
}
