package com.sentraicu.alarmengine.hub.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "hub_bed_assignments")
public class HubBedAssignmentEntity {

    @Id
    private UUID id;

    @Column(nullable = false)
    private UUID visitId;

    @Column(nullable = false)
    private UUID bedId;

    @Column(nullable = false)
    private Instant assignedAt;

    private Instant releasedAt;

    @Column(nullable = false)
    private boolean active = true;

    @PrePersist
    void onCreate() {
        if (id == null) id = UUID.randomUUID();
        if (assignedAt == null) assignedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getVisitId() { return visitId; }
    public void setVisitId(UUID visitId) { this.visitId = visitId; }
    public UUID getBedId() { return bedId; }
    public void setBedId(UUID bedId) { this.bedId = bedId; }
    public Instant getAssignedAt() { return assignedAt; }
    public void setAssignedAt(Instant assignedAt) { this.assignedAt = assignedAt; }
    public Instant getReleasedAt() { return releasedAt; }
    public void setReleasedAt(Instant releasedAt) { this.releasedAt = releasedAt; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
}
