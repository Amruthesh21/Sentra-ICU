package com.sentraicu.alarmengine.auth.repo;

import com.sentraicu.alarmengine.auth.entity.HubPasswordResetTokenEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface HubPasswordResetTokenRepository extends JpaRepository<HubPasswordResetTokenEntity, UUID> {
    Optional<HubPasswordResetTokenEntity> findByIdAndConsumedFalse(UUID id);
}
