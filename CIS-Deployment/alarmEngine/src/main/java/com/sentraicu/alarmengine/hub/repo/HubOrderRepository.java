package com.sentraicu.alarmengine.hub.repo;

import com.sentraicu.alarmengine.hub.entity.HubOrderEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface HubOrderRepository extends JpaRepository<HubOrderEntity, UUID> {
    List<HubOrderEntity> findByVisitIdOrderByOrderedAtDesc(UUID visitId);
}
