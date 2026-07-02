package com.rtwo.alarmengine.hub.repo;

import com.rtwo.alarmengine.hub.entity.HubBedAssignmentEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface HubBedAssignmentRepository extends JpaRepository<HubBedAssignmentEntity, UUID> {
    Optional<HubBedAssignmentEntity> findByBedIdAndActiveTrue(UUID bedId);
    Optional<HubBedAssignmentEntity> findByVisitIdAndActiveTrue(UUID visitId);
    List<HubBedAssignmentEntity> findByActiveTrue();
    Optional<HubBedAssignmentEntity> findFirstByVisitIdOrderByAssignedAtDesc(UUID visitId);
}
