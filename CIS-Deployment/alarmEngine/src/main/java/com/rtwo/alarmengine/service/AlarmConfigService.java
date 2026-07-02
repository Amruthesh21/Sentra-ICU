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
        validateRequest(request);

        String canonicalBedId = BedIdUtil.canonicalAlarmBedId(request.getBedId());
        request.setBedId(canonicalBedId);

        DoctorAlarmConfig config = findExistingConfig(request.getDoctorId(), request.getBedId())
                .orElse(new DoctorAlarmConfig());

        if (config.getId() == null) {
            config.setCreatedAt(Instant.now());
        }
        config.setDoctorId(request.getDoctorId());
        config.setBedId(canonicalBedId);
        config.setPatientMRN(request.getPatientMRN());
        config.setPatientName(request.getPatientName());
        config.setAlarms(request.getAlarms());
        config.setUpdatedAt(Instant.now());

        DoctorAlarmConfig saved = repository.save(config);
        cacheService.invalidate(canonicalBedId);
        alarmArmingService.rearmBedAndEvaluate(canonicalBedId);
        return saved;
    }

    public List<DoctorAlarmConfig> getByDoctorId(String doctorId) {
        return repository.findByDoctorId(doctorId);
    }

    public void delete(String doctorId, String bedId) {
        String canonicalBedId = BedIdUtil.canonicalAlarmBedId(bedId);
        repository.deleteByDoctorIdAndBedId(doctorId, canonicalBedId);
        for (String variant : BedIdUtil.allLookupIds(bedId)) {
            repository.findByDoctorIdAndBedId(doctorId, variant)
                    .ifPresent(existing -> repository.delete(existing));
        }
        cacheService.invalidate(canonicalBedId);
    }

    private java.util.Optional<DoctorAlarmConfig> findExistingConfig(String doctorId, String bedId) {
        java.util.Optional<DoctorAlarmConfig> direct = repository.findByDoctorIdAndBedId(doctorId, bedId);
        if (direct.isPresent()) {
            return direct;
        }
        for (String variant : BedIdUtil.allLookupIds(bedId)) {
            java.util.Optional<DoctorAlarmConfig> match = repository.findByDoctorIdAndBedId(doctorId, variant);
            if (match.isPresent()) {
                return match;
            }
        }
        return java.util.Optional.empty();
    }

    private void validateRequest(AlarmConfigRequest request) {
        if (request.getDoctorId() == null || request.getDoctorId().isBlank()) {
            throw new IllegalArgumentException("doctorId is required");
        }
        if (request.getBedId() == null || request.getBedId().isBlank()) {
            throw new IllegalArgumentException("bedId is required");
        }
        if (request.getAlarms() == null || request.getAlarms().isEmpty()) {
            throw new IllegalArgumentException("At least one alarm threshold is required");
        }

        for (DoctorAlarmConfig.AlarmThreshold threshold : request.getAlarms()) {
            if (threshold.getEnabled() == null || !threshold.getEnabled()) {
                continue;
            }
            Double high = threshold.getHighThreshold();
            Double low = threshold.getLowThreshold();
            String label = threshold.getParamName() != null ? threshold.getParamName() : "Parameter";
            if (high == null && low == null) {
                throw new IllegalArgumentException(label + ": set at least one limit when alarm is enabled");
            }
            if (high != null && low != null && high <= low) {
                throw new IllegalArgumentException(label + ": high limit must be greater than low limit");
            }
        }
    }
}
