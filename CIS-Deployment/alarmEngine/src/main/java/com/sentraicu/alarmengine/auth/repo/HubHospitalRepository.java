package com.sentraicu.alarmengine.auth.repo;

import com.sentraicu.alarmengine.auth.entity.HubHospitalEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface HubHospitalRepository extends JpaRepository<HubHospitalEntity, UUID> {
    Optional<HubHospitalEntity> findByCodeIgnoreCase(String code);
    boolean existsByCodeIgnoreCase(String code);
    List<HubHospitalEntity> findAllByOrderByNameAsc();
}
