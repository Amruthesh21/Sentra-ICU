package com.rtwo.alarmengine.auth.security;

import com.rtwo.alarmengine.auth.config.AuthProperties;
import com.rtwo.alarmengine.auth.entity.HubAuthUserEntity;
import com.rtwo.alarmengine.auth.repo.HubAuthUserRepository;
import com.rtwo.alarmengine.auth.service.JwtService;
import com.rtwo.alarmengine.auth.service.PermissionService;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class JwtAuthFilter extends OncePerRequestFilter {

    public static final String AUTH_ATTR = "authPrincipal";

    private final AuthProperties properties;
    private final JwtService jwtService;
    private final HubAuthUserRepository userRepository;
    private final PermissionService permissionService;

    public JwtAuthFilter(
            AuthProperties properties,
            JwtService jwtService,
            HubAuthUserRepository userRepository,
            PermissionService permissionService) {
        this.properties = properties;
        this.jwtService = jwtService;
        this.userRepository = userRepository;
        this.permissionService = permissionService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        String path = request.getRequestURI();
        if (isPublic(path)) {
            chain.doFilter(request, response);
            return;
        }

        String header = request.getHeader("Authorization");
        AuthPrincipal principal = null;

        if (header != null && header.startsWith("Bearer ")) {
            try {
                String token = header.substring(7);
                Claims claims = jwtService.parse(token);
                UUID userId = jwtService.userIdFromClaims(claims);
                HubAuthUserEntity user = userRepository.findById(userId).orElse(null);
                if (user != null && user.isActive()) {
                    List<String> permissions = permissionService.permissionsFor(user);
                    principal = AuthPrincipal.from(user, permissions);
                    request.setAttribute(AUTH_ATTR, principal);
                }
            } catch (Exception ignored) {
            }
        }

        if (properties.isEnforced() && principal == null) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Authentication required\",\"status\":\"error\"}");
            return;
        }

        chain.doFilter(request, response);
    }

    private boolean isPublic(String path) {
        if (path.startsWith("/api/auth")) return true;
        if (path.startsWith("/alarm-ui")) return true;
        return false;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) return true;
        return false;
    }
}
