package com.rtwo.alarmengine.hub.repo;

import com.rtwo.alarmengine.hub.entity.HubPatientVisitEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface HubPatientVisitRepository extends JpaRepository<HubPatientVisitEntity, UUID> {
    List<HubPatientVisitEntity> findByPatientIdOrderByVisitNumberDesc(UUID patientId);
    long countByPatientId(UUID patientId);
    List<HubPatientVisitEntity> findByStatusOrderByDischargedAtDesc(String status);
}
