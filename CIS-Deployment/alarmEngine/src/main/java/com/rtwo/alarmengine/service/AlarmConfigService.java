package com.rtwo.alarmengine.service;

import com.rtwo.alarmengine.dto.AlarmConfigRequest;
import com.rtwo.alarmengine.entity.DoctorAlarmConfig;
import com.rtwo.alarmengine.repository.DoctorAlarmConfigRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
public class AlarmConfigService {

    private final DoctorAlarmConfigRepository repository;
    private final AlarmConfigCacheService cacheService;
    private final AlarmArmingService alarmArmingService;

    public AlarmConfigService(DoctorAlarmConfigRepository repository,
                              AlarmConfigCacheService cacheService,
                              AlarmArmingService alarmArmingService) {
        this.repository = repository;
        this.cacheService = cacheService;
        this.alarmArmingService = alarmArmingService;
    }

    public DoctorAlarmConfig saveOrUpdate(AlarmConfigRequest request) {
        DoctorAlarmConfig config = repository
                .findByDoctorIdAndBedId(request.getDoctorId(), request.getBedId())
                .orElse(new DoctorAlarmConfig());

        if (config.getId() == null) {
            config.setCreatedAt(Instant.now());
        }
        config.setDoctorId(request.getDoctorId());
        config.setBedId(request.getBedId());
        config.setPatientMRN(request.getPatientMRN());
        config.setPatientName(request.getPatientName());
        config.setAlarms(request.getAlarms());
        config.setUpdatedAt(Instant.now());

        DoctorAlarmConfig saved = repository.save(config);
        cacheService.invalidate(request.getBedId());
        alarmArmingService.rearmBedAndEvaluate(request.getBedId());
        return saved;
    }

    public List<DoctorAlarmConfig> getByDoctorId(String doctorId) {
        return repository.findByDoctorId(doctorId);
    }

    public void delete(String doctorId, String bedId) {
        repository.deleteByDoctorIdAndBedId(doctorId, bedId);
        cacheService.invalidate(bedId);
    }
}
