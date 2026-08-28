package com.sentraicu.alarmengine.hub.repo;

import com.sentraicu.alarmengine.hub.entity.HubAdmissionDraftEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface HubAdmissionDraftRepository extends JpaRepository<HubAdmissionDraftEntity, UUID> {
}
