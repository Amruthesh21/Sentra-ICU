package com.sentraicu.alarmengine.auth.repo;

import com.sentraicu.alarmengine.auth.entity.HubUserPhotoEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface HubUserPhotoRepository extends JpaRepository<HubUserPhotoEntity, UUID> {
}
