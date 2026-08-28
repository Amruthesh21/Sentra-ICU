package com.sentraicu.alarmengine.hub.repo;

import com.sentraicu.alarmengine.hub.entity.HubImagingStudyEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface HubImagingStudyRepository extends JpaRepository<HubImagingStudyEntity, UUID> {
    List<HubImagingStudyEntity> findByVisitIdOrderByStudyAtDesc(UUID visitId);
}
