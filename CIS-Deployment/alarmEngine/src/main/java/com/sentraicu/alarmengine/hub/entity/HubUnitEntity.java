package com.sentraicu.alarmengine.hub.entity;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "hub_units")
public class HubUnitEntity {

    @Id
    private UUID id;

    @Column(nullable = false)
    private String centerId;

    @Column(nullable = false)
    private String code;

    @Column(nullable = false)
    private String name;

    private String blockName;

    @PrePersist
    void onCreate() {
        if (id == null) id = UUID.randomUUID();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getCenterId() { return centerId; }
    public void setCenterId(String centerId) { this.centerId = centerId; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getBlockName() { return blockName; }
    public void setBlockName(String blockName) { this.blockName = blockName; }
}
