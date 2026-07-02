package com.rtwo.alarmengine.auth.bootstrap;

import com.rtwo.alarmengine.auth.config.AuthProperties;
import com.rtwo.alarmengine.auth.entity.HubAuthUserEntity;
import com.rtwo.alarmengine.auth.repo.HubAuthUserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class AuthBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AuthBootstrap.class);

    private final HubAuthUserRepository userRepository;
    private final AuthProperties properties;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    public AuthBootstrap(HubAuthUserRepository userRepository, AuthProperties properties) {
        this.userRepository = userRepository;
        this.properties = properties;
    }

    @Override
    public void run(ApplicationArguments args) {
        String email = properties.getSuperAdmin().getEmail();
        if (email == null || email.isBlank()) return;

        var existing = userRepository.findByEmailIgnoreCase(email.trim());
        if (existing.isPresent()) {
            HubAuthUserEntity user = existing.get();
            boolean updated = false;
            if (!user.isSuperAdmin()) {
                user.setUserType("SUPER_ADMIN");
                user.setRole("SUPER_ADMIN");
                updated = true;
            }
            if (user.getUsername() == null || user.getUsername().isBlank()) {
                user.setUsername(properties.getSuperAdmin().getUsername());
                updated = true;
            }
            String pwd = properties.getSuperAdmin().getPassword();
            if (pwd != null && !pwd.isBlank() && (user.getPasswordHash() == null || user.getPasswordHash().isBlank())) {
                user.setPasswordHash(encoder.encode(pwd));
                updated = true;
            }
            if (updated) {
                userRepository.save(user);
                log.info("Updated super admin account: {}", email);
            }
            return;
        }

        String pwd = properties.getSuperAdmin().getPassword();
        if (pwd == null || pwd.isBlank()) {
            log.warn("Super admin {} not found and SUPER_ADMIN_PASSWORD not set — skipping seed", email);
            return;
        }

        HubAuthUserEntity user = new HubAuthUserEntity();
        user.setEmail(email.trim().toLowerCase());
        user.setUsername(properties.getSuperAdmin().getUsername());
        user.setDisplayName(properties.getSuperAdmin().getDisplayName());
        user.setPasswordHash(encoder.encode(pwd));
        user.setUserType("SUPER_ADMIN");
        user.setRole("SUPER_ADMIN");
        user.setActive(true);
        user.setTotpEnabled(false);
        user.setMustChangePassword(false);
        userRepository.save(user);
        log.info("Seeded super admin account: {}", email);
    }
}
