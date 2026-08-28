package com.sentraicu.alarmengine.controller;

import com.sentraicu.alarmengine.dto.AlarmEvent;
import com.sentraicu.alarmengine.service.ActiveAlarmStore;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import java.util.List;

@Controller
public class AlarmUiController {

    private final ActiveAlarmStore activeAlarmStore;

    public AlarmUiController(ActiveAlarmStore activeAlarmStore) {
        this.activeAlarmStore = activeAlarmStore;
    }

    @GetMapping("/alarm-ui")
    public String alarmUi(Model model) {
        model.addAttribute("alarms", activeAlarmStore.getActiveAlarms());
        return "alarm-ui";
    }

    @GetMapping("/alarm-ui/api/active")
    @ResponseBody
    public List<AlarmEvent> activeAlarmsApi() {
        return activeAlarmStore.getActiveAlarms();
    }
}
