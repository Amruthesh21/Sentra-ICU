package com.sentraicu.alarmengine.auth.service;

import com.sentraicu.alarmengine.auth.config.AuthProperties;
import com.sentraicu.alarmengine.auth.entity.HubAuthSessionEntity;
import com.sentraicu.alarmengine.auth.entity.HubAuthUserEntity;
import com.sentraicu.alarmengine.auth.entity.HubMfaChallengeEntity;
import com.sentraicu.alarmengine.auth.entity.HubPasswordResetTokenEntity;
import com.sentraicu.alarmengine.auth.repo.HubAuthSessionRepository;
import com.sentraicu.alarmengine.auth.repo.HubAuthUserRepository;
import com.sentraicu.alarmengine.auth.repo.HubMfaChallengeRepository;
import com.sentraicu.alarmengine.auth.repo.HubPasswordResetTokenRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;

@Service
public class AuthService {

    private final HubAuthUserRepository userRepository;
    private final HubMfaChallengeRepository challengeRepository;
    private final HubAuthSessionRepository sessionRepository;
    private final HubPasswordResetTokenRepository resetTokenRepository;
    private final AuthProperties properties;
    private final JwtService jwtService;
    private final TotpService totpService;
    private final EmailOtpService emailOtpService;
    private final PermissionService permissionService;
    private final JdbcTemplate jdbcTemplate;
    private final AuditLogService auditLogService;
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final SecureRandom random = new SecureRandom();

    public AuthService(
            HubAuthUserRepository userRepository,
            HubMfaChallengeRepository challengeRepository,
            HubAuthSessionRepository sessionRepository,
            HubPasswordResetTokenRepository resetTokenRepository,
            AuthProperties properties,
            JwtService jwtService,
            TotpService totpService,
            EmailOtpService emailOtpService,
            PermissionService permissionService,
            JdbcTemplate jdbcTemplate,
            AuditLogService auditLogService) {
        this.userRepository = userRepository;
        this.challengeRepository = challengeRepository;
        this.sessionRepository = sessionRepository;
        this.resetTokenRepository = resetTokenRepository;
        this.properties = properties;
        this.jwtService = jwtService;
        this.totpService = totpService;
        this.emailOtpService = emailOtpService;
        this.permissionService = permissionService;
        this.jdbcTemplate = jdbcTemplate;
        this.auditLogService = auditLogService;
    }

    @Transactional
    public Map<String, Object> login(String loginId, String password, String ipAddress, String userAgent) {
        String trimmed = loginId.trim();
        HubAuthUserEntity user = resolveUserForLogin(trimmed)
                .orElseThrow(() -> new AuthException("Invalid username or password"));

        if (!user.isActive()) {
            throw new AuthException("Account is disabled");
        }
        assertHospitalAccessAllowed(user);
        if (user.getPasswordHash() == null || !passwordEncoder.matches(password, user.getPasswordHash())) {
            audit(user, "LOGIN_FAILED", "Invalid password", ipAddress);
            throw new AuthException("Invalid username or password");
        }

        if (user.isMustChangePassword()) {
            if (!trimmed.contains("@") || !user.getEmail().equalsIgnoreCase(trimmed)) {
                throw new AuthException("First sign-in requires your registered hospital admin email address.");
            }
            return beginAccountSetup(user);
        }

        if (isMfaTrusted(user)) {
            Map<String, Object> session = issueTokens(user, userAgent, ipAddress);
            session.put("mfaRequired", false);
            return session;
        }

        return beginMfaChallenge(user);
    }

    @Transactional
    public Map<String, Object> completeAccountSetup(
            String setupToken,
            String username,
            String password,
            String confirmPassword,
            String displayName,
            String specialty,
            String userAgent,
            String ipAddress) {
        UUID tokenId = UUID.fromString(setupToken);
        HubMfaChallengeEntity setup = challengeRepository.findByIdAndConsumedFalse(tokenId)
                .orElseThrow(() -> new AuthException("Setup session expired. Please sign in again."));
        if (!"SETUP".equalsIgnoreCase(setup.getChannel())) {
            throw new AuthException("Invalid setup session");
        }
        if (setup.getExpiresAt().isBefore(Instant.now())) {
            throw new AuthException("Setup session expired. Please sign in again.");
        }

        HubAuthUserEntity user = userRepository.findById(setup.getUserId())
                .orElseThrow(() -> new AuthException("User not found"));
        if (!user.isMustChangePassword()) {
            throw new AuthException("Account setup already completed");
        }

        validateNewPassword(password, confirmPassword);
        String normalizedUsername = username.trim();
        if (normalizedUsername.length() < 3) {
            throw new AuthException("Username must be at least 3 characters");
        }
        if (userRepository.existsByUsernameIgnoreCase(normalizedUsername)
                && !normalizedUsername.equalsIgnoreCase(user.getUsername())) {
            throw new AuthException("Username is already taken");
        }

        user.setUsername(normalizedUsername);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setDisplayName(displayName != null && !displayName.isBlank() ? displayName.trim() : user.getDisplayName());
        user.setSpecialty(specialty != null ? specialty.trim() : null);
        user.setMustChangePassword(false);
        userRepository.save(user);

        setup.setConsumed(true);
        challengeRepository.save(setup);

        audit(user, "ACCOUNT_SETUP", "Hospital admin completed first-time account setup", ipAddress);
        Map<String, Object> session = issueTokens(user, userAgent, ipAddress);
        session.put("mfaRequired", false);
        return session;
    }

    @Transactional
    public Map<String, Object> forgotPassword(String email) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("ok", true);
        result.put("message", "If an account exists for this email, a reset code has been sent.");

        if (email == null || email.isBlank()) {
            return result;
        }

        userRepository.findByEmailIgnoreCase(email.trim()).ifPresent(user -> {
            if (!user.isActive()) return;

            String code = generateOtp();
            HubPasswordResetTokenEntity token = new HubPasswordResetTokenEntity();
            token.setUserId(user.getId());
            token.setTokenHash(passwordEncoder.encode(code.replaceAll("\\s", "")));
            token.setExpiresAt(Instant.now().plusSeconds(properties.getOtp().getResetExpiryMinutes() * 60L));
            token.setConsumed(false);
            resetTokenRepository.save(token);

            boolean emailed = emailOtpService.sendPasswordResetCode(user.getEmail(), code);
            result.put("resetToken", token.getId().toString());
            result.put("maskedEmail", EmailOtpService.maskEmail(user.getEmail()));
            attachOtpDelivery(result, code, emailed, false);
        });
        return result;
    }

    @Transactional
    public Map<String, Object> resetPassword(String resetToken, String code, String password, String confirmPassword) {
        UUID tokenId = UUID.fromString(resetToken);
        HubPasswordResetTokenEntity token = resetTokenRepository.findByIdAndConsumedFalse(tokenId)
                .orElseThrow(() -> new AuthException("Reset session expired. Request a new code."));

        if (token.getExpiresAt().isBefore(Instant.now())) {
            throw new AuthException("Reset code expired. Request a new code.");
        }

        if (!passwordEncoder.matches(code.replaceAll("\\s", ""), token.getTokenHash())) {
            throw new AuthException("Invalid reset code");
        }

        validateNewPassword(password, confirmPassword);

        HubAuthUserEntity user = userRepository.findById(token.getUserId())
                .orElseThrow(() -> new AuthException("User not found"));

        user.setPasswordHash(passwordEncoder.encode(password));
        user.setMustChangePassword(false);
        userRepository.save(user);

        token.setConsumed(true);
        resetTokenRepository.save(token);

        audit(user, "PASSWORD_RESET", "Password reset via email token", null);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("ok", true);
        result.put("message", "Password updated. You can sign in with your new password.");
        return result;
    }

    @Transactional
    public Map<String, Object> verifyMfa(String mfaToken, String code, String method, String userAgent, String ipAddress) {
        UUID challengeId = UUID.fromString(mfaToken);
        HubMfaChallengeEntity challenge = challengeRepository.findByIdAndConsumedFalse(challengeId)
                .orElseThrow(() -> new AuthException("Verification session expired. Please sign in again."));

        if (challenge.getExpiresAt().isBefore(Instant.now())) {
            throw new AuthException("Verification code expired. Please sign in again.");
        }
        if (challenge.getAttemptCount() >= 5) {
            throw new AuthException("Too many attempts. Please sign in again.");
        }

        HubAuthUserEntity user = userRepository.findById(challenge.getUserId())
                .orElseThrow(() -> new AuthException("User not found"));

        boolean ok = false;
        String normalizedMethod = method != null ? method.toLowerCase(Locale.ROOT) : "email";
        if ("totp".equals(normalizedMethod)) {
            if (!user.isTotpEnabled() || user.getTotpSecret() == null) {
                throw new AuthException("Authenticator not enrolled");
            }
            ok = totpService.verify(user.getTotpSecret(), code);
        } else {
            ok = passwordEncoder.matches(code.replaceAll("\\s", ""), challenge.getCodeHash());
        }

        challenge.setAttemptCount(challenge.getAttemptCount() + 1);
        if (!ok) {
            challengeRepository.save(challenge);
            throw new AuthException("Invalid verification code");
        }

        challenge.setConsumed(true);
        challengeRepository.save(challenge);

        Map<String, Object> session = issueTokens(user, userAgent, ipAddress);
        session.put("mfaRequired", false);
        return session;
    }

    @Transactional
    public Map<String, Object> resendMfa(String mfaToken) {
        UUID challengeId = UUID.fromString(mfaToken);
        HubMfaChallengeEntity old = challengeRepository.findByIdAndConsumedFalse(challengeId)
                .orElseThrow(() -> new AuthException("Verification session expired. Please sign in again."));

        HubAuthUserEntity user = userRepository.findById(old.getUserId())
                .orElseThrow(() -> new AuthException("User not found"));

        old.setConsumed(true);
        challengeRepository.save(old);

        String otp = generateOtp();
        HubMfaChallengeEntity challenge = new HubMfaChallengeEntity();
        challenge.setUserId(user.getId());
        challenge.setChannel("EMAIL");
        challenge.setCodeHash(passwordEncoder.encode(otp));
        challenge.setExpiresAt(Instant.now().plusSeconds(properties.getOtp().getExpiryMinutes() * 60L));
        challenge.setConsumed(false);
        challengeRepository.save(challenge);

        boolean emailed = emailOtpService.sendLoginOtp(user.getEmail(), otp);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("mfaToken", challenge.getId().toString());
        result.put("maskedEmail", EmailOtpService.maskEmail(user.getEmail()));
        result.put("resendAfterSeconds", 30);
        attachOtpDelivery(result, otp, emailed, true);
        return result;
    }

    @Transactional
    public Map<String, Object> refresh(String sessionId, String refreshToken) {
        UUID sid = UUID.fromString(sessionId);
        HubAuthSessionEntity session = sessionRepository.findByIdAndRevokedFalse(sid)
                .orElseThrow(() -> new AuthException("Session expired"));

        if (session.getExpiresAt().isBefore(Instant.now())) {
            session.setRevoked(true);
            sessionRepository.save(session);
            throw new AuthException("Session expired");
        }
        if (!passwordEncoder.matches(refreshToken, session.getRefreshHash())) {
            throw new AuthException("Invalid session");
        }

        HubAuthUserEntity user = userRepository.findById(session.getUserId())
                .orElseThrow(() -> new AuthException("User not found"));

        session.setRevoked(true);
        sessionRepository.save(session);

        return issueTokens(user, session.getUserAgent(), null);
    }

    @Transactional
    public void logout(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) return;
        try {
            UUID sid = UUID.fromString(sessionId);
            sessionRepository.findById(sid).ifPresent(s -> {
                s.setRevoked(true);
                sessionRepository.save(s);
            });
        } catch (IllegalArgumentException ignored) {
        }
    }

    public Map<String, Object> me(HubAuthUserEntity user) {
        List<String> permissions = permissionService.permissionsFor(user);
        return new LinkedHashMap<>(jwtService.userPayload(user, permissions));
    }

    @Transactional
    public Map<String, String> startTotpEnrollment(HubAuthUserEntity user) {
        try {
            String secret = totpService.generateSecret();
            user.setTotpSecret(secret);
            user.setTotpEnabled(false);
            userRepository.save(user);
            return totpService.buildEnrollment(user, secret);
        } catch (Exception e) {
            throw new AuthException("Failed to start authenticator enrollment");
        }
    }

    @Transactional
    public void confirmTotpEnrollment(HubAuthUserEntity user, String code) {
        if (user.getTotpSecret() == null) {
            throw new AuthException("Enrollment not started");
        }
        if (!totpService.verify(user.getTotpSecret(), code)) {
            throw new AuthException("Invalid authenticator code");
        }
        user.setTotpEnabled(true);
        userRepository.save(user);
        audit(user, "TOTP_ENROLLED", "Authenticator enrolled", null);
    }

    private Optional<HubAuthUserEntity> resolveUserForLogin(String loginId) {
        if (loginId.contains("@")) {
            return userRepository.findByEmailIgnoreCase(loginId);
        }
        return userRepository.findByEmailIgnoreCaseOrUsernameIgnoreCase(loginId, loginId);
    }

    private boolean isMfaTrusted(HubAuthUserEntity user) {
        return user.getMfaTrustedUntil() != null && user.getMfaTrustedUntil().isAfter(Instant.now());
    }

    private Map<String, Object> beginAccountSetup(HubAuthUserEntity user) {
        HubMfaChallengeEntity setup = new HubMfaChallengeEntity();
        setup.setUserId(user.getId());
        setup.setChannel("SETUP");
        setup.setCodeHash(passwordEncoder.encode("setup"));
        setup.setExpiresAt(Instant.now().plusSeconds(1800));
        setup.setConsumed(false);
        setup.setAttemptCount(0);
        challengeRepository.save(setup);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("setupRequired", true);
        result.put("setupToken", setup.getId().toString());
        result.put("maskedEmail", EmailOtpService.maskEmail(user.getEmail()));
        result.put("mfaRequired", false);
        return result;
    }

    private Map<String, Object> beginMfaChallenge(HubAuthUserEntity user) {
        String otp = generateOtp();
        HubMfaChallengeEntity challenge = new HubMfaChallengeEntity();
        challenge.setUserId(user.getId());
        challenge.setChannel("EMAIL");
        challenge.setCodeHash(passwordEncoder.encode(otp));
        challenge.setExpiresAt(Instant.now().plusSeconds(properties.getOtp().getExpiryMinutes() * 60L));
        challenge.setConsumed(false);
        challenge.setAttemptCount(0);
        challengeRepository.save(challenge);

        boolean emailed = emailOtpService.sendLoginOtp(user.getEmail(), otp);

        List<String> methods = new ArrayList<>();
        methods.add("email");
        if (user.isTotpEnabled() && user.getTotpSecret() != null) {
            methods.add("totp");
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("mfaRequired", true);
        result.put("mfaToken", challenge.getId().toString());
        result.put("maskedEmail", EmailOtpService.maskEmail(user.getEmail()));
        result.put("methods", methods);
        result.put("resendAfterSeconds", 30);
        attachOtpDelivery(result, otp, emailed, false);
        return result;
    }

    private Map<String, Object> issueTokens(HubAuthUserEntity user, String userAgent, String ipAddress) {
        assertHospitalAccessAllowed(user);
        user.setLastLoginAt(Instant.now());
        user.setMfaTrustedUntil(Instant.now().plusSeconds(properties.getMfa().getTrustMinutes() * 60L));
        userRepository.save(user);

        List<String> permissions = permissionService.permissionsFor(user);
        String accessToken = jwtService.createAccessToken(user, permissions);
        String refreshRaw = jwtService.createRefreshTokenValue();

        HubAuthSessionEntity session = new HubAuthSessionEntity();
        session.setUserId(user.getId());
        session.setRefreshHash(passwordEncoder.encode(refreshRaw));
        session.setExpiresAt(Instant.now().plusSeconds(properties.getJwt().getRefreshDays() * 86400L));
        session.setRevoked(false);
        session.setUserAgent(userAgent);
        sessionRepository.save(session);

        audit(user, "LOGIN_SUCCESS", "Signed in successfully", ipAddress);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("accessToken", accessToken);
        result.put("refreshToken", refreshRaw);
        result.put("sessionId", session.getId().toString());
        result.put("user", jwtService.userPayload(user, permissions));
        result.put("mfaRequired", false);
        return result;
    }

    private void validateNewPassword(String password, String confirmPassword) {
        if (password == null || password.length() < 8) {
            throw new AuthException("Password must be at least 8 characters");
        }
        if (!password.equals(confirmPassword)) {
            throw new AuthException("Passwords do not match");
        }
    }

    private void attachOtpDelivery(Map<String, Object> result, String otp, boolean emailed, boolean showCodeOnResend) {
        result.put("emailSent", emailed);
        if (properties.isDevExposeOtp()) {
            result.put("devMode", true);
            result.put("devOtp", otp);
            if (!emailed) {
                result.put("emailDeliveryFailed", true);
            }
            return;
        }
        if (emailed && !showCodeOnResend) {
            return;
        }
        if (!emailed) {
            result.put("emailDeliveryFailed", true);
        }
        if (!emailed || showCodeOnResend) {
            result.put("devOtp", otp);
        }
    }

    private String generateOtp() {
        if (properties.isDevExposeOtp()) {
            return "123456";
        }
        int n = 100000 + random.nextInt(900000);
        return String.valueOf(n);
    }

    private void audit(HubAuthUserEntity user, String action, String detail, String ipAddress) {
        if (user == null) {
            return;
        }
        auditLogService.recordAuth(user, action, detail, ipAddress);
    }

    private void assertHospitalAccessAllowed(HubAuthUserEntity user) {
        if (user.isSuperAdmin() || user.getHospitalId() == null) {
            return;
        }
        String status = jdbcTemplate.queryForObject(
                "SELECT status FROM hub_hospitals WHERE id = ?",
                String.class,
                user.getHospitalId());
        if (status == null || !"ACTIVE".equalsIgnoreCase(status)) {
            throw new AuthException("Hospital is inactive. Contact your platform administrator.");
        }
    }

    public static class AuthException extends RuntimeException {
        public AuthException(String message) {
            super(message);
        }
    }
}
