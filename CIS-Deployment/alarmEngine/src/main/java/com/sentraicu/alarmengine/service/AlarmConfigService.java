package com.sentraicu.alarmengine.service;

import com.sentraicu.alarmengine.dto.AlarmConfigRequest;
import com.sentraicu.alarmengine.entity.DoctorAlarmConfig;
import com.sentraicu.alarmengine.repository.DoctorAlarmConfigRepository;
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
        // Drop true duplicates for the same canonical bed (different stored bedId string), never touch other beds.
        for (DoctorAlarmConfig other : repository.findByDoctorId(request.getDoctorId())) {
            if (other.getId() != null
                    && !other.getId().equals(saved.getId())
                    && canonicalBedId.equals(BedIdUtil.canonicalAlarmBedId(other.getBedId()))) {
                repository.delete(other);
            }
        }
        cacheService.invalidate(canonicalBedId);
        alarmArmingService.rearmBedAndEvaluate(canonicalBedId);
        return saved;
    }

    public List<DoctorAlarmConfig> getByDoctorId(String doctorId) {
        return repository.findByDoctorId(doctorId);
    }

    public void delete(String doctorId, String bedId) {
        // Exact stored bedId only. Do NOT canonicalize then delete — that mapped
        // ICU-1-BED-01 → ICU-1-BED 1 and wiped the live config after every "purge".
        repository.findByDoctorIdAndBedId(doctorId, bedId).ifPresent(repository::delete);
        cacheService.invalidate(bedId);
        cacheService.invalidate(BedIdUtil.canonicalAlarmBedId(bedId));
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
