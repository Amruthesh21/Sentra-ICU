package com.sentraicu.alarmengine.auth.repo;

import com.sentraicu.alarmengine.auth.entity.HubAuthSessionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface HubAuthSessionRepository extends JpaRepository<HubAuthSessionEntity, UUID> {
    Optional<HubAuthSessionEntity> findByIdAndRevokedFalse(UUID id);
}
