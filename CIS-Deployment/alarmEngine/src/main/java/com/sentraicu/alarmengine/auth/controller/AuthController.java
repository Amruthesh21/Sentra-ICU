package com.sentraicu.alarmengine.auth.controller;

import com.sentraicu.alarmengine.auth.entity.HubAuthUserEntity;
import com.sentraicu.alarmengine.auth.repo.HubAuthUserRepository;
import com.sentraicu.alarmengine.auth.security.AuthPrincipal;
import com.sentraicu.alarmengine.auth.security.JwtAuthFilter;
import com.sentraicu.alarmengine.auth.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final HubAuthUserRepository userRepository;

    public AuthController(AuthService authService, HubAuthUserRepository userRepository) {
        this.authService = authService;
        this.userRepository = userRepository;
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody Map<String, String> body, HttpServletRequest request) {
        String loginId = body.getOrDefault("username", body.get("email"));
        String password = body.get("password");
        if (loginId == null || password == null) {
            throw new AuthService.AuthException("Username and password are required");
        }
        String portal = body.getOrDefault("portal", body.get("area"));
        return ResponseEntity.ok(authService.login(
                loginId, password, portal, clientIp(request), request.getHeader("User-Agent")));
    }

    @PostMapping("/mfa/verify")
    public ResponseEntity<Map<String, Object>> verifyMfa(@RequestBody Map<String, String> body, HttpServletRequest request) {
        String mfaToken = body.get("mfaToken");
        String code = body.get("code");
        String method = body.getOrDefault("method", "email");
        if (mfaToken == null || code == null) {
            throw new AuthService.AuthException("Verification code required");
        }
        return ResponseEntity.ok(authService.verifyMfa(mfaToken, code, method, request.getHeader("User-Agent"), clientIp(request)));
    }

    @PostMapping("/setup/complete")
    public ResponseEntity<Map<String, Object>> completeSetup(@RequestBody Map<String, String> body, HttpServletRequest request) {
        String setupToken = body.get("setupToken");
        if (setupToken == null) throw new AuthService.AuthException("Setup session expired");
        return ResponseEntity.ok(authService.completeAccountSetup(
                setupToken,
                body.get("username"),
                body.get("password"),
                body.get("confirmPassword"),
                body.get("displayName"),
                body.get("specialty"),
                request.getHeader("User-Agent"),
                clientIp(request)));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, Object>> forgotPassword(@RequestBody Map<String, String> body) {
        return ResponseEntity.ok(authService.forgotPassword(body.get("email")));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, Object>> resetPassword(@RequestBody Map<String, String> body) {
        return ResponseEntity.ok(authService.resetPassword(
                body.get("resetToken"),
                body.get("code"),
                body.get("password"),
                body.get("confirmPassword")));
    }

    @PostMapping("/mfa/resend")
    public ResponseEntity<Map<String, Object>> resendMfa(@RequestBody Map<String, String> body) {
        String mfaToken = body.get("mfaToken");
        if (mfaToken == null) throw new AuthService.AuthException("Session expired");
        return ResponseEntity.ok(authService.resendMfa(mfaToken));
    }

    @PostMapping("/refresh")
    public ResponseEntity<Map<String, Object>> refresh(@RequestBody Map<String, String> body) {
        return ResponseEntity.ok(authService.refresh(body.get("sessionId"), body.get("refreshToken")));
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, Object>> logout(@RequestBody(required = false) Map<String, String> body) {
        if (body != null) authService.logout(body.get("sessionId"));
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> me(HttpServletRequest request) {
        HubAuthUserEntity user = currentUser(request);
        return ResponseEntity.ok(authService.me(user));
    }

    @PostMapping("/totp/enroll")
    public ResponseEntity<Map<String, String>> enrollTotp(HttpServletRequest request) {
        HubAuthUserEntity user = currentUser(request);
        return ResponseEntity.ok(authService.startTotpEnrollment(user));
    }

    @PostMapping("/totp/confirm")
    public ResponseEntity<Map<String, Object>> confirmTotp(@RequestBody Map<String, String> body, HttpServletRequest request) {
        HubAuthUserEntity user = currentUser(request);
        authService.confirmTotpEnrollment(user, body.get("code"));
        return ResponseEntity.ok(Map.of("ok", true, "totpEnabled", true));
    }

    private HubAuthUserEntity currentUser(HttpServletRequest request) {
        AuthPrincipal principal = (AuthPrincipal) request.getAttribute(JwtAuthFilter.AUTH_ATTR);
        if (principal == null) throw new AuthService.AuthException("Authentication required");
        return userRepository.findById(principal.getUserId())
                .orElseThrow(() -> new AuthService.AuthException("User not found"));
    }

    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
