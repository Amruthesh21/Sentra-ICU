package com.rtwo.alarmengine.service;

import com.rtwo.alarmengine.dto.DeviceDataMessage;
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
        activeAlarmStore.rearmBed(bedId);
        notifyStateService.rearmBed(bedId);

        DeviceDataMessage latest = latestVitalsStore.get(bedId);
        if (latest != null) {
            alarmCheckService.processVitals(latest);
        }
    }
}
