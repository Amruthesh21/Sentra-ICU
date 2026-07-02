package com.rtwo.alarmengine.hub.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "hub_beds")
public class HubBedEntity {

    @Id
    private UUID id;

    @Column(nullable = false)
    private String centerId;

    private UUID unitId;

    @Column(nullable = false)
    private String bedLabel;

    private String deviceIp;
    private String mongoBedId;
    private String simulationMode;

    @Column(nullable = false)
    private boolean active = true;

    @Column(nullable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (id == null) id = UUID.randomUUID();
        if (createdAt == null) createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getCenterId() { return centerId; }
    public void setCenterId(String centerId) { this.centerId = centerId; }
    public UUID getUnitId() { return unitId; }
    public void setUnitId(UUID unitId) { this.unitId = unitId; }
    public String getBedLabel() { return bedLabel; }
    public void setBedLabel(String bedLabel) { this.bedLabel = bedLabel; }
    public String getDeviceIp() { return deviceIp; }
    public void setDeviceIp(String deviceIp) { this.deviceIp = deviceIp; }
    public String getMongoBedId() { return mongoBedId; }
    public void setMongoBedId(String mongoBedId) { this.mongoBedId = mongoBedId; }
    public String getSimulationMode() { return simulationMode; }
    public void setSimulationMode(String simulationMode) { this.simulationMode = simulationMode; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public Instant getCreatedAt() { return createdAt; }
}
