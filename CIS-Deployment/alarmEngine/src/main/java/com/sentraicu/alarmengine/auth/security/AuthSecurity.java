package com.sentraicu.alarmengine.auth.security;

import com.sentraicu.alarmengine.auth.entity.HubAuthUserEntity;
import com.sentraicu.alarmengine.auth.repo.HubAuthUserRepository;
import com.sentraicu.alarmengine.auth.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class AuthSecurity {

    private final HubAuthUserRepository userRepository;

    public AuthSecurity(HubAuthUserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public HubAuthUserEntity requireUser(HttpServletRequest request) {
        AuthPrincipal principal = (AuthPrincipal) request.getAttribute(JwtAuthFilter.AUTH_ATTR);
        if (principal == null) {
            throw new AuthService.AuthException("Authentication required");
        }
        return userRepository.findById(principal.getUserId())
                .orElseThrow(() -> new AuthService.AuthException("User not found"));
    }

    public HubAuthUserEntity requireSuperAdmin(HttpServletRequest request) {
        HubAuthUserEntity user = requireUser(request);
        if (!user.isSuperAdmin()) {
            throw new AuthService.AuthException("Super admin access required");
        }
        return user;
    }

    public HubAuthUserEntity requireHospitalAdmin(HttpServletRequest request) {
        HubAuthUserEntity user = requireUser(request);
        if (user.isSuperAdmin()) return user;
        if (user.getHospitalId() == null) {
            throw new AuthService.AuthException("Hospital access required");
        }
        if (!"HOSPITAL_ADMIN".equalsIgnoreCase(user.getRole())
                && !"ADMIN".equalsIgnoreCase(user.getRole())) {
            throw new AuthService.AuthException("Hospital admin access required");
        }
        return user;
    }

    public UUID hospitalScope(HubAuthUserEntity user) {
        if (user.isSuperAdmin()) return null;
        if (user.getHospitalId() == null) {
            throw new AuthService.AuthException("Hospital not assigned");
        }
        return user.getHospitalId();
    }
}
