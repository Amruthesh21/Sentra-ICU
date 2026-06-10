package com.rtwo.alarmengine.service;

import com.rtwo.alarmengine.entity.DoctorAlarmConfig;
import com.rtwo.alarmengine.repository.DoctorAlarmConfigRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AlarmConfigCacheService {

    private final DoctorAlarmConfigRepository repository;
    private final long ttlSeconds;
    private final Map<String, CachedEntry> bedCache = new ConcurrentHashMap<>();

    public AlarmConfigCacheService(DoctorAlarmConfigRepository repository,
                                   @Value("${alarm.config.cache-ttl-seconds}") long ttlSeconds) {
        this.repository = repository;
        this.ttlSeconds = ttlSeconds;
    }

    public List<DoctorAlarmConfig> getConfigsForBed(String bedId) {
        CachedEntry entry = bedCache.get(bedId);
        if (entry != null && !entry.isExpired()) {
            return entry.configs();
        }
        List<DoctorAlarmConfig> configs = repository.findByBedId(bedId);
        bedCache.put(bedId, new CachedEntry(configs, Instant.now().plusSeconds(ttlSeconds)));
        return configs;
    }

    public void invalidate(String bedId) {
        bedCache.remove(bedId);
    }

    public void invalidateAll() {
        bedCache.clear();
    }

    private record CachedEntry(List<DoctorAlarmConfig> configs, Instant expiresAt) {
        boolean isExpired() {
            return Instant.now().isAfter(expiresAt);
        }
    }
}
