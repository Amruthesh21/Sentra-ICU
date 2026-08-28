package com.sentraicu.alarmengine.hub.repo;

import com.sentraicu.alarmengine.hub.entity.HubPatientEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface HubPatientRepository extends JpaRepository<HubPatientEntity, UUID> {
    Optional<HubPatientEntity> findByMrn(String mrn);

    @Query("""
            SELECT p FROM HubPatientEntity p
            WHERE LOWER(p.fullName) LIKE LOWER(CONCAT('%', :q, '%'))
               OR LOWER(p.mrn) LIKE LOWER(CONCAT('%', :q, '%'))
               OR LOWER(COALESCE(p.externalId, '')) LIKE LOWER(CONCAT('%', :q, '%'))
            ORDER BY p.fullName
            """)
    List<HubPatientEntity> search(@Param("q") String q);

    long countByMrn(String mrn);
}
