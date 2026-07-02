package com.rtwo.alarmengine.hub.repo;

import com.rtwo.alarmengine.hub.entity.HubAdmissionDraftEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface HubAdmissionDraftRepository extends JpaRepository<HubAdmissionDraftEntity, UUID> {
}
