package com.sentraicu.alarmengine.auth.security;

import com.sentraicu.alarmengine.auth.entity.HubAuthUserEntity;

import java.util.List;
import java.util.UUID;

public class AuthPrincipal {
    private final UUID userId;
    private final String email;
    private final String userType;
    private final String role;
    private final UUID hospitalId;
    private final List<String> permissions;

    public AuthPrincipal(UUID userId, String email, String userType, String role, UUID hospitalId, List<String> permissions) {
        this.userId = userId;
        this.email = email;
        this.userType = userType;
        this.role = role;
        this.hospitalId = hospitalId;
        this.permissions = permissions;
    }

    public static AuthPrincipal from(HubAuthUserEntity user, List<String> permissions) {
        return new AuthPrincipal(user.getId(), user.getEmail(), user.getUserType(), user.getRole(), user.getHospitalId(), permissions);
    }

    public UUID getUserId() { return userId; }
    public String getEmail() { return email; }
    public String getUserType() { return userType; }
    public String getRole() { return role; }
    public UUID getHospitalId() { return hospitalId; }
    public List<String> getPermissions() { return permissions; }
    public boolean isSuperAdmin() { return "SUPER_ADMIN".equalsIgnoreCase(userType); }
}
