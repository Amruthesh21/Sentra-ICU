package com.rtwo.alarmengine.auth.repo;

import com.rtwo.alarmengine.auth.entity.HubAuthUserEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface HubAuthUserRepository extends JpaRepository<HubAuthUserEntity, UUID> {
    Optional<HubAuthUserEntity> findByEmailIgnoreCase(String email);
    Optional<HubAuthUserEntity> findByUsernameIgnoreCase(String username);
    Optional<HubAuthUserEntity> findByEmailIgnoreCaseOrUsernameIgnoreCase(String email, String username);
    boolean existsByEmailIgnoreCase(String email);
    boolean existsByUsernameIgnoreCase(String username);
    List<HubAuthUserEntity> findByHospitalIdOrderByDisplayNameAsc(UUID hospitalId);
}
