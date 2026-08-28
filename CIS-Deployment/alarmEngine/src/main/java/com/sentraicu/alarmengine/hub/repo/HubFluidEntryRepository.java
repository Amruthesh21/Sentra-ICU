package com.sentraicu.alarmengine.hub.repo;

import com.sentraicu.alarmengine.hub.entity.HubFluidEntryEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface HubFluidEntryRepository extends JpaRepository<HubFluidEntryEntity, UUID> {
    List<HubFluidEntryEntity> findByVisitIdAndRecordedAtBetweenOrderByRecordedAtAsc(
            UUID visitId, Instant from, Instant to);
}
