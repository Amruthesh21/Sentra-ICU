package com.rtwo.alarmengine.config;

import com.rtwo.alarmengine.dto.DeviceDataMessage;
import com.rtwo.alarmengine.service.AlarmCheckService;
import com.rtwo.alarmengine.service.LatestVitalsStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

import java.time.Instant;
import java.util.List;

@Configuration
@EnableScheduling
@ConditionalOnProperty(prefix = "alarm.demo-vitals", name = "enabled", havingValue = "true")
public class DemoVitalsPublisher {

    private static final Logger log = LoggerFactory.getLogger(DemoVitalsPublisher.class);
    private static final String DEMO_BED = "ICU-1-BED-01";

    private final LatestVitalsStore latestVitalsStore;
    private final AlarmCheckService alarmCheckService;
    private double spo2 = 98.0;
    private double heartRate = 72.0;

    public DemoVitalsPublisher(LatestVitalsStore latestVitalsStore, AlarmCheckService alarmCheckService) {
        this.latestVitalsStore = latestVitalsStore;
        this.alarmCheckService = alarmCheckService;
    }

    @Bean
    CommandLineRunner logDemoVitalsPublisher() {
        return args -> log.warn("DEMO vitals publisher is ON — disable alarm.demo-vitals.enabled for live CIS data");
    }

    @Scheduled(fixedRate = 2000)
    public void publishDemoVitals() {
        spo2 = 96.0 + (Math.random() * 3.0);
        heartRate = 68.0 + (Math.random() * 12.0);

        DeviceDataMessage message = new DeviceDataMessage();
        message.setBedId(DEMO_BED);
        message.setDeviceType("BplUltimaPrimeDevice");
        message.setTimestamp(Instant.now().toString());
        message.setPrimaryAttributes(List.of(
                attr("SpO2", spo2, "%"),
                attr("HeartRate", heartRate, "bpm"),
                attr("Pulse", heartRate, "bpm"),
                attr("Temp1", 36.8 + (Math.random() * 0.4), "C")
        ));
        message.setSecondaryAttributes(List.of(
                attr("Resp.Rate", 14.0 + (Math.random() * 4.0), "/min"),
                attr("PEEP", 5.0 + (Math.random() * 2.0), "cmH2O"),
                attr("MV", 7.5 + (Math.random() * 1.5), "L/min"),
                attr("Peak", 18.0 + (Math.random() * 4.0), "cmH2O"),
                attr("VT", 450.0 + (Math.random() * 50.0), "mL")
        ));

        latestVitalsStore.put(message);
        alarmCheckService.processVitals(message);
    }

    private DeviceDataMessage.VitalAttribute attr(String name, double value, String unit) {
        DeviceDataMessage.VitalAttribute attr = new DeviceDataMessage.VitalAttribute();
        attr.setParamName(name);
        attr.setValue(Math.round(value * 10.0) / 10.0);
        attr.setUnit(unit);
        return attr;
    }
}
