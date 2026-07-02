package com.rtwo.alarmengine.service;

import com.rtwo.alarmengine.entity.DoctorAlarmConfig;
import com.rtwo.alarmengine.repository.DoctorAlarmConfigRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
        String canonical = BedIdUtil.canonicalAlarmBedId(bedId);
        CachedEntry entry = bedCache.get(canonical);
        if (entry != null && !entry.isExpired()) {
            return entry.configs();
        }

        List<String> lookupIds = BedIdUtil.allLookupIds(bedId);
        List<DoctorAlarmConfig> configs = lookupIds.isEmpty()
                ? List.of()
                : repository.findByBedIdIn(lookupIds);

        List<DoctorAlarmConfig> deduped = dedupeByDoctor(configs);
        bedCache.put(canonical, new CachedEntry(deduped, Instant.now().plusSeconds(ttlSeconds)));
        return deduped;
    }

    public void invalidate(String bedId) {
        for (String id : BedIdUtil.allLookupIds(bedId)) {
            bedCache.remove(BedIdUtil.canonicalAlarmBedId(id));
            bedCache.remove(id);
        }
    }

    public void invalidateAll() {
        bedCache.clear();
    }

    private List<DoctorAlarmConfig> dedupeByDoctor(List<DoctorAlarmConfig> configs) {
        Set<String> seen = new LinkedHashSet<>();
        List<DoctorAlarmConfig> result = new ArrayList<>();
        for (DoctorAlarmConfig config : configs) {
            String key = config.getDoctorId() + "|" + BedIdUtil.canonicalAlarmBedId(config.getBedId());
            if (seen.add(key)) {
                result.add(config);
            }
        }
        return result;
    }

    private record CachedEntry(List<DoctorAlarmConfig> configs, Instant expiresAt) {
        boolean isExpired() {
            return Instant.now().isAfter(expiresAt);
        }
    }
}
