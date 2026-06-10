package com.rtwo.alarmengine.config;

import com.rtwo.alarmengine.entity.DoctorAlarmConfig;
import com.rtwo.alarmengine.repository.DoctorAlarmConfigRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;

@Configuration
public class DemoDataSeeder {

    private static final Logger log = LoggerFactory.getLogger(DemoDataSeeder.class);

    @Bean
    CommandLineRunner seedDemoAlarmConfig(DoctorAlarmConfigRepository repository) {
        return args -> {
            if (repository.findByDoctorIdAndBedId("doctor-001", "ICU-1-BED-01").isPresent()) {
                log.info("Demo alarm config already exists, skipping seed");
                return;
            }

            DoctorAlarmConfig config = new DoctorAlarmConfig();
            config.setDoctorId("doctor-001");
            config.setBedId("ICU-1-BED-01");
            // Patient name/MRN come from CIS centerEntity when admitted on ICU Connect
            config.setPatientMRN(null);
            config.setPatientName(null);
            config.setCreatedAt(Instant.now());
            config.setUpdatedAt(Instant.now());
            config.setAlarms(buildDemoThresholds());

            repository.save(config);
            log.info("Seeded demo alarm config for doctor-001 / ICU-1-BED-01");
        };
    }

    private List<DoctorAlarmConfig.AlarmThreshold> buildDemoThresholds() {
        return Arrays.asList(
                threshold("SpO2", null, 90.0, true),
                threshold("HeartRate", 120.0, 50.0, true),
                threshold("Temp1", 38.5, null, true),
                threshold("Resp.Rate", 30.0, 8.0, false),
                threshold("PEEP", 20.0, 5.0, false),
                threshold("MV", 15.0, 4.0, false),
                threshold("Peak", 40.0, 10.0, false),
                threshold("VT", 800.0, 200.0, false)
        );
    }

    private DoctorAlarmConfig.AlarmThreshold threshold(String param, Double high, Double low, boolean enabled) {
        DoctorAlarmConfig.AlarmThreshold t = new DoctorAlarmConfig.AlarmThreshold();
        t.setParamName(param);
        t.setHighThreshold(high);
        t.setLowThreshold(low);
        t.setEnabled(enabled);
        return t;
    }
}
