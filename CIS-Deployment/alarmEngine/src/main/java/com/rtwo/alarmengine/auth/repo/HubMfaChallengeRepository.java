package com.rtwo.alarmengine.auth.repo;

import com.rtwo.alarmengine.auth.entity.HubMfaChallengeEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface HubMfaChallengeRepository extends JpaRepository<HubMfaChallengeEntity, UUID> {
    Optional<HubMfaChallengeEntity> findByIdAndConsumedFalse(UUID id);
}
