package com.sentraicu.alarmengine.hub.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "hub_orders")
public class HubOrderEntity {

    @Id
    private UUID id;

    @Column(nullable = false)
    private UUID visitId;

    @Column(nullable = false)
    private UUID patientId;

    private String bedLabel;

    @Column(nullable = false)
    private String orderType;

    @Column(nullable = false, columnDefinition = "text")
    private String orderText;

    private String drugName;
    private String dose;
    private String route;
    private String frequency;
    private String duration;

    @Column(columnDefinition = "text")
    private String notes;

    @Column(nullable = false)
    private String priority;

    @Column(nullable = false)
    private String status;

    private String orderedBy;
    private String discontinueReason;
    private Instant discontinuedAt;

    @Column(nullable = false)
    private Instant orderedAt;

    @Column(nullable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (id == null) id = UUID.randomUUID();
        Instant now = Instant.now();
        if (orderedAt == null) orderedAt = now;
        if (createdAt == null) createdAt = now;
        if (priority == null) priority = "ROUTINE";
        if (status == null) status = "APPROVED";
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getVisitId() { return visitId; }
    public void setVisitId(UUID visitId) { this.visitId = visitId; }
    public UUID getPatientId() { return patientId; }
    public void setPatientId(UUID patientId) { this.patientId = patientId; }
    public String getBedLabel() { return bedLabel; }
    public void setBedLabel(String bedLabel) { this.bedLabel = bedLabel; }
    public String getOrderType() { return orderType; }
    public void setOrderType(String orderType) { this.orderType = orderType; }
    public String getOrderText() { return orderText; }
    public void setOrderText(String orderText) { this.orderText = orderText; }
    public String getDrugName() { return drugName; }
    public void setDrugName(String drugName) { this.drugName = drugName; }
    public String getDose() { return dose; }
    public void setDose(String dose) { this.dose = dose; }
    public String getRoute() { return route; }
    public void setRoute(String route) { this.route = route; }
    public String getFrequency() { return frequency; }
    public void setFrequency(String frequency) { this.frequency = frequency; }
    public String getDuration() { return duration; }
    public void setDuration(String duration) { this.duration = duration; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getOrderedBy() { return orderedBy; }
    public void setOrderedBy(String orderedBy) { this.orderedBy = orderedBy; }
    public String getDiscontinueReason() { return discontinueReason; }
    public void setDiscontinueReason(String discontinueReason) { this.discontinueReason = discontinueReason; }
    public Instant getDiscontinuedAt() { return discontinuedAt; }
    public void setDiscontinuedAt(Instant discontinuedAt) { this.discontinuedAt = discontinuedAt; }
    public Instant getOrderedAt() { return orderedAt; }
    public void setOrderedAt(Instant orderedAt) { this.orderedAt = orderedAt; }
    public Instant getCreatedAt() { return createdAt; }
}
