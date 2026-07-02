package com.rtwo.alarmengine.auth.service;

import com.rtwo.alarmengine.auth.config.AuthProperties;
import com.rtwo.alarmengine.auth.entity.HubAuthUserEntity;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class JwtService {

    private final AuthProperties properties;
    private final SecretKey key;

    public JwtService(AuthProperties properties) {
        this.properties = properties;
        byte[] bytes = properties.getJwt().getSecret().getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            byte[] padded = new byte[32];
            System.arraycopy(bytes, 0, padded, 0, bytes.length);
            bytes = padded;
        }
        this.key = Keys.hmacShaKeyFor(bytes);
    }

    public String createAccessToken(HubAuthUserEntity user, List<String> permissions) {
        Instant now = Instant.now();
        Instant exp = now.plusSeconds(properties.getJwt().getAccessMinutes() * 60L);
        return Jwts.builder()
                .subject(user.getId().toString())
                .claim("email", user.getEmail())
                .claim("username", user.getUsername())
                .claim("displayName", user.getDisplayName())
                .claim("userType", user.getUserType())
                .claim("role", user.getRole())
                .claim("hospitalId", user.getHospitalId() != null ? user.getHospitalId().toString() : null)
                .claim("permissions", permissions)
                .issuedAt(Date.from(now))
                .expiration(Date.from(exp))
                .signWith(key)
                .compact();
    }

    public Claims parse(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public UUID userIdFromClaims(Claims claims) {
        return UUID.fromString(claims.getSubject());
    }

    public String createRefreshTokenValue() {
        return UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "");
    }

    public Map<String, Object> userPayload(HubAuthUserEntity user, List<String> permissions) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", user.getId().toString());
        payload.put("email", user.getEmail());
        payload.put("username", user.getUsername() != null ? user.getUsername() : "");
        payload.put("displayName", user.getDisplayName() != null ? user.getDisplayName() : user.getEmail());
        payload.put("userType", user.getUserType());
        payload.put("role", user.getRole());
        payload.put("hospitalId", user.getHospitalId() != null ? user.getHospitalId().toString() : "");
        payload.put("totpEnabled", user.isTotpEnabled());
        payload.put("mustChangePassword", user.isMustChangePassword());
        payload.put("specialty", user.getSpecialty() != null ? user.getSpecialty() : "");
        payload.put("permissions", permissions);
        return payload;
    }
}
