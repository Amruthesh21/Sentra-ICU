package com.sentraicu.alarmengine.auth.repo;

import com.sentraicu.alarmengine.auth.entity.HubRoleEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface HubRoleRepository extends JpaRepository<HubRoleEntity, UUID> {
    List<HubRoleEntity> findByHospitalIdOrderByNameAsc(UUID hospitalId);
    Optional<HubRoleEntity> findByHospitalIdAndNameIgnoreCase(UUID hospitalId, String name);
    boolean existsByHospitalIdAndNameIgnoreCase(UUID hospitalId, String name);
}
