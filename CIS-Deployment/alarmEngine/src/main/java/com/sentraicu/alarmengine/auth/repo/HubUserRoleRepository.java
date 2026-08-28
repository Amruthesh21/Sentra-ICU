package com.sentraicu.alarmengine.auth.repo;

import com.sentraicu.alarmengine.auth.entity.HubUserRoleEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface HubUserRoleRepository extends JpaRepository<HubUserRoleEntity, HubUserRoleEntity.Pk> {
    List<HubUserRoleEntity> findByUserId(UUID userId);
    void deleteByUserId(UUID userId);
}
