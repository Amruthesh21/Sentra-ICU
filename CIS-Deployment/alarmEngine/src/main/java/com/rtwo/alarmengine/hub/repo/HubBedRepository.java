package com.rtwo.alarmengine.hub.repo;

import com.rtwo.alarmengine.hub.entity.HubBedEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface HubBedRepository extends JpaRepository<HubBedEntity, UUID> {
    Optional<HubBedEntity> findByCenterIdAndBedLabel(String centerId, String bedLabel);
    List<HubBedEntity> findByCenterIdAndActiveTrueOrderByBedLabel(String centerId);
    List<HubBedEntity> findByCenterIdAndUnitIdAndActiveTrueOrderByBedLabel(String centerId, UUID unitId);
    long countByUnitIdAndActiveTrue(UUID unitId);
}
