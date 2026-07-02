package com.rtwo.alarmengine.hub.repo;

import com.rtwo.alarmengine.hub.entity.HubScoreSnapshotEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface HubScoreSnapshotRepository extends JpaRepository<HubScoreSnapshotEntity, UUID> {

    List<HubScoreSnapshotEntity> findByVisitIdAndScoreTypeOrderByCalculatedAtDesc(
            UUID visitId, String scoreType);

    List<HubScoreSnapshotEntity> findByVisitIdOrderByCalculatedAtDesc(UUID visitId);

    Optional<HubScoreSnapshotEntity> findTop1ByVisitIdAndScoreTypeOrderByCalculatedAtDesc(
            UUID visitId, String scoreType);

    @Query("""
            SELECT s FROM HubScoreSnapshotEntity s
            WHERE s.visitId = :visitId
              AND s.scoreType = :scoreType
              AND s.calculatedAt >= :from
            ORDER BY s.calculatedAt ASC
            """)
    List<HubScoreSnapshotEntity> findHistory(@Param("visitId") UUID visitId,
                                             @Param("scoreType") String scoreType,
                                             @Param("from") Instant from);
}
