package com.rtwo.alarmengine.hub.repo;

import com.rtwo.alarmengine.hub.entity.HubClinicalNoteEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface HubClinicalNoteRepository extends JpaRepository<HubClinicalNoteEntity, UUID> {
    List<HubClinicalNoteEntity> findByVisitIdOrderByUpdatedAtDesc(UUID visitId);
}
