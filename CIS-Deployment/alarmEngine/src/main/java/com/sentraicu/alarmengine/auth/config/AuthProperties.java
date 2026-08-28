package com.sentraicu.alarmengine.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "hub.auth")
public class AuthProperties {

    private final Jwt jwt = new Jwt();
    private final SuperAdmin superAdmin = new SuperAdmin();
    private final Otp otp = new Otp();
    private final Mfa mfa = new Mfa();
    private final Mail mail = new Mail();

    private boolean enforced = false;
    private boolean devExposeOtp = true;

    public Jwt getJwt() { return jwt; }
    public SuperAdmin getSuperAdmin() { return superAdmin; }
    public Otp getOtp() { return otp; }
    public Mfa getMfa() { return mfa; }
    public Mail getMail() { return mail; }
    public boolean isEnforced() { return enforced; }
    public void setEnforced(boolean enforced) { this.enforced = enforced; }
    public boolean isDevExposeOtp() { return devExposeOtp; }
    public void setDevExposeOtp(boolean devExposeOtp) { this.devExposeOtp = devExposeOtp; }

    public static class Jwt {
        private String secret;
        private int accessMinutes = 60;
        private int refreshDays = 14;
        public String getSecret() { return secret; }
        public void setSecret(String secret) { this.secret = secret; }
        public int getAccessMinutes() { return accessMinutes; }
        public void setAccessMinutes(int accessMinutes) { this.accessMinutes = accessMinutes; }
        public int getRefreshDays() { return refreshDays; }
        public void setRefreshDays(int refreshDays) { this.refreshDays = refreshDays; }
    }

    public static class SuperAdmin {
        private String email;
        private String username;
        private String displayName;
        private String password;
        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
        public String getUsername() { return username; }
        public void setUsername(String username) { this.username = username; }
        public String getDisplayName() { return displayName; }
        public void setDisplayName(String displayName) { this.displayName = displayName; }
        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }
    }

    public static class Otp {
        private int expiryMinutes = 5;
        private int resetExpiryMinutes = 15;
        public int getExpiryMinutes() { return expiryMinutes; }
        public void setExpiryMinutes(int expiryMinutes) { this.expiryMinutes = expiryMinutes; }
        public int getResetExpiryMinutes() { return resetExpiryMinutes; }
        public void setResetExpiryMinutes(int resetExpiryMinutes) { this.resetExpiryMinutes = resetExpiryMinutes; }
    }

    public static class Mfa {
        private String issuer = "Sentra ICU";
        private int trustMinutes = 60;
        public String getIssuer() { return issuer; }
        public void setIssuer(String issuer) { this.issuer = issuer; }
        public int getTrustMinutes() { return trustMinutes; }
        public void setTrustMinutes(int trustMinutes) { this.trustMinutes = trustMinutes; }
    }

    public static class Mail {
        private String from;
        private boolean enabled;
        public String getFrom() { return from; }
        public void setFrom(String from) { this.from = from; }
        public boolean isEnabled() { return enabled; }
        public void setEnabled(boolean enabled) { this.enabled = enabled; }
    }
}
