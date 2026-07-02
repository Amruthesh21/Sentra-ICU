package com.rtwo.alarmengine.auth.entity;

import jakarta.persistence.*;
import java.io.Serializable;
import java.util.UUID;

@Entity
@Table(name = "hub_user_roles")
@IdClass(HubUserRoleEntity.Pk.class)
public class HubUserRoleEntity {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Id
    @Column(name = "role_id")
    private UUID roleId;

    public HubUserRoleEntity() {}

    public HubUserRoleEntity(UUID userId, UUID roleId) {
        this.userId = userId;
        this.roleId = roleId;
    }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }
    public UUID getRoleId() { return roleId; }
    public void setRoleId(UUID roleId) { this.roleId = roleId; }

    public static class Pk implements Serializable {
        public UUID userId;
        public UUID roleId;

        public Pk() {}

        public Pk(UUID userId, UUID roleId) {
            this.userId = userId;
            this.roleId = roleId;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof Pk pk)) return false;
            return userId.equals(pk.userId) && roleId.equals(pk.roleId);
        }

        @Override
        public int hashCode() {
            return userId.hashCode() * 31 + roleId.hashCode();
        }
    }
}
