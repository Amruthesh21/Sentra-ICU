package com.sentraicu.alarmengine.hub.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "hub_lab_results")
public class HubLabResultEntity {

    @Id
    private UUID id;

    @Column(nullable = false)
    private UUID visitId;

    @Column(nullable = false)
    private UUID patientId;

    @Column(nullable = false)
    private String testName;

    private String value;
    private String unit;
    private String referenceRange;
    private String flag;

    @Column(nullable = false)
    private String status;

    @Column(nullable = false)
    private Instant resultedAt;

    @Column(nullable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (id == null) id = UUID.randomUUID();
        Instant now = Instant.now();
        if (resultedAt == null) resultedAt = now;
        if (createdAt == null) createdAt = now;
        if (status == null) status = "FINAL";
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getVisitId() { return visitId; }
    public void setVisitId(UUID visitId) { this.visitId = visitId; }
    public UUID getPatientId() { return patientId; }
    public void setPatientId(UUID patientId) { this.patientId = patientId; }
    public String getTestName() { return testName; }
    public void setTestName(String testName) { this.testName = testName; }
    public String getValue() { return value; }
    public void setValue(String value) { this.value = value; }
    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }
    public String getReferenceRange() { return referenceRange; }
    public void setReferenceRange(String referenceRange) { this.referenceRange = referenceRange; }
    public String getFlag() { return flag; }
    public void setFlag(String flag) { this.flag = flag; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Instant getResultedAt() { return resultedAt; }
    public void setResultedAt(Instant resultedAt) { this.resultedAt = resultedAt; }
    public Instant getCreatedAt() { return createdAt; }
}
