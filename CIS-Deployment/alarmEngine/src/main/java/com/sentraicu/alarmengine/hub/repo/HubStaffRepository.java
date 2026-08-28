package com.sentraicu.alarmengine.hub.repo;

import com.sentraicu.alarmengine.hub.entity.HubStaffEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface HubStaffRepository extends JpaRepository<HubStaffEntity, UUID> {
    List<HubStaffEntity> findByCenterIdAndActiveTrueOrderByFullNameAsc(String centerId);
    List<HubStaffEntity> findByCenterIdAndActiveTrueAndRoleCodeInOrderByFullNameAsc(String centerId, List<String> roleCodes);
}
