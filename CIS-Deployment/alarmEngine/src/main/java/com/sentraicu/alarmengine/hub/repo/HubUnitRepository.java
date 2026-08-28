package com.sentraicu.alarmengine.hub.repo;

import com.sentraicu.alarmengine.hub.entity.HubUnitEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface HubUnitRepository extends JpaRepository<HubUnitEntity, UUID> {
    List<HubUnitEntity> findByCenterIdOrderByNameAsc(String centerId);
    Optional<HubUnitEntity> findByCenterIdAndCode(String centerId, String code);
    boolean existsByCenterIdAndCode(String centerId, String code);
}
