package com.sentraicu.alarmengine.hub.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "hub_fluid_entries")
public class HubFluidEntryEntity {

    @Id
    private UUID id;

    @Column(nullable = false)
    private UUID visitId;

    @Column(nullable = false)
    private UUID patientId;

    private String bedLabel;

    @Column(nullable = false, length = 16)
    private String entryType;

    @Column(nullable = false, length = 64)
    private String category;

    @Column(nullable = false, length = 128)
    private String fluidName;

    private BigDecimal volumeMl;

    private String unit;

    @Column(nullable = false)
    private Instant recordedAt;

    @Column(columnDefinition = "text")
    private String notes;

    private String recordedBy;

    @Column(length = 16)
    private String intakeMode;

    private BigDecimal rateMlPerHr;

    private Instant startedAt;

    private Instant stoppedAt;

    @Column(length = 16)
    private String runningStatus;

    @Column(nullable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (id == null) id = UUID.randomUUID();
        if (createdAt == null) createdAt = Instant.now();
        if (unit == null) unit = "ml";
        if (intakeMode == null) intakeMode = "ONE_TIME";
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getVisitId() { return visitId; }
    public void setVisitId(UUID visitId) { this.visitId = visitId; }
    public UUID getPatientId() { return patientId; }
    public void setPatientId(UUID patientId) { this.patientId = patientId; }
    public String getBedLabel() { return bedLabel; }
    public void setBedLabel(String bedLabel) { this.bedLabel = bedLabel; }
    public String getEntryType() { return entryType; }
    public void setEntryType(String entryType) { this.entryType = entryType; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getFluidName() { return fluidName; }
    public void setFluidName(String fluidName) { this.fluidName = fluidName; }
    public BigDecimal getVolumeMl() { return volumeMl; }
    public void setVolumeMl(BigDecimal volumeMl) { this.volumeMl = volumeMl; }
    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }
    public Instant getRecordedAt() { return recordedAt; }
    public void setRecordedAt(Instant recordedAt) { this.recordedAt = recordedAt; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public String getRecordedBy() { return recordedBy; }
    public void setRecordedBy(String recordedBy) { this.recordedBy = recordedBy; }
    public String getIntakeMode() { return intakeMode; }
    public void setIntakeMode(String intakeMode) { this.intakeMode = intakeMode; }
    public BigDecimal getRateMlPerHr() { return rateMlPerHr; }
    public void setRateMlPerHr(BigDecimal rateMlPerHr) { this.rateMlPerHr = rateMlPerHr; }
    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant startedAt) { this.startedAt = startedAt; }
    public Instant getStoppedAt() { return stoppedAt; }
    public void setStoppedAt(Instant stoppedAt) { this.stoppedAt = stoppedAt; }
    public String getRunningStatus() { return runningStatus; }
    public void setRunningStatus(String runningStatus) { this.runningStatus = runningStatus; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
