package com.sentraicu.alarmengine.auth.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "hub_user_photos")
public class HubUserPhotoEntity {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "content_type", nullable = false, length = 64)
    private String contentType;

    @Column(name = "photo_bytes", nullable = false, columnDefinition = "bytea")
    private byte[] photoBytes;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }
    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }
    public byte[] getPhotoBytes() { return photoBytes; }
    public void setPhotoBytes(byte[] photoBytes) { this.photoBytes = photoBytes; }
    public Instant getUpdatedAt() { return updatedAt; }
}
