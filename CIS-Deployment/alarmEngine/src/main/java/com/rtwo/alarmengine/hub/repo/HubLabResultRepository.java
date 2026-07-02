package com.rtwo.alarmengine.hub.repo;

import com.rtwo.alarmengine.hub.entity.HubLabResultEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface HubLabResultRepository extends JpaRepository<HubLabResultEntity, UUID> {
    List<HubLabResultEntity> findByVisitIdOrderByResultedAtDesc(UUID visitId);
}
