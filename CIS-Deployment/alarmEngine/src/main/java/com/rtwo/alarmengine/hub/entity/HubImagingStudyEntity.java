package com.rtwo.alarmengine.hub.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "hub_imaging_studies")
public class HubImagingStudyEntity {

    @Id
    private UUID id;

    @Column(nullable = false)
    private UUID visitId;

    @Column(nullable = false)
    private UUID patientId;

    @Column(nullable = false)
    private String modality;

    @Column(nullable = false)
    private String studyName;

    @Column(columnDefinition = "text")
    private String findings;

    @Column(columnDefinition = "text")
    private String impression;

    @Column(nullable = false)
    private String status;

    @Column(nullable = false)
    private Instant studyAt;

    private String imageUrl;

    @Column(nullable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (id == null) id = UUID.randomUUID();
        Instant now = Instant.now();
        if (studyAt == null) studyAt = now;
        if (createdAt == null) createdAt = now;
        if (status == null) status = "FINAL";
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getVisitId() { return visitId; }
    public void setVisitId(UUID visitId) { this.visitId = visitId; }
    public UUID getPatientId() { return patientId; }
    public void setPatientId(UUID patientId) { this.patientId = patientId; }
    public String getModality() { return modality; }
    public void setModality(String modality) { this.modality = modality; }
    public String getStudyName() { return studyName; }
    public void setStudyName(String studyName) { this.studyName = studyName; }
    public String getFindings() { return findings; }
    public void setFindings(String findings) { this.findings = findings; }
    public String getImpression() { return impression; }
    public void setImpression(String impression) { this.impression = impression; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Instant getStudyAt() { return studyAt; }
    public void setStudyAt(Instant studyAt) { this.studyAt = studyAt; }
    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }
    public Instant getCreatedAt() { return createdAt; }
}
