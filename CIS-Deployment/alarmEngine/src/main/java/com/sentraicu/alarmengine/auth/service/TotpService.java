package com.sentraicu.alarmengine.auth.service;

import com.sentraicu.alarmengine.auth.config.AuthProperties;
import com.sentraicu.alarmengine.auth.entity.HubAuthUserEntity;
import dev.samstevens.totp.code.*;
import dev.samstevens.totp.exceptions.QrGenerationException;
import dev.samstevens.totp.qr.QrData;
import dev.samstevens.totp.qr.QrGenerator;
import dev.samstevens.totp.qr.ZxingPngQrGenerator;
import dev.samstevens.totp.secret.DefaultSecretGenerator;
import dev.samstevens.totp.time.SystemTimeProvider;
import dev.samstevens.totp.time.TimeProvider;
import org.springframework.stereotype.Service;

import java.util.Base64;
import java.util.Map;

@Service
public class TotpService {

    private final AuthProperties properties;
    private final CodeVerifier verifier;
    private final DefaultSecretGenerator secretGenerator = new DefaultSecretGenerator();
    private final QrGenerator qrGenerator = new ZxingPngQrGenerator();

    public TotpService(AuthProperties properties) {
        this.properties = properties;
        TimeProvider timeProvider = new SystemTimeProvider();
        CodeGenerator codeGenerator = new DefaultCodeGenerator();
        this.verifier = new DefaultCodeVerifier(codeGenerator, timeProvider);
    }

    public String generateSecret() {
        return secretGenerator.generate();
    }

    public boolean verify(String secret, String code) {
        if (secret == null || secret.isBlank() || code == null) return false;
        String normalized = code.replaceAll("\\s", "");
        return verifier.isValidCode(secret, normalized);
    }

    public Map<String, String> buildEnrollment(HubAuthUserEntity user, String secret) throws QrGenerationException {
        QrData data = new QrData.Builder()
                .label(user.getEmail())
                .secret(secret)
                .issuer(properties.getMfa().getIssuer())
                .algorithm(HashingAlgorithm.SHA1)
                .digits(6)
                .period(30)
                .build();
        byte[] image = qrGenerator.generate(data);
        String otpauth = "otpauth://totp/" + properties.getMfa().getIssuer() + ":" + user.getEmail()
                + "?secret=" + secret + "&issuer=" + properties.getMfa().getIssuer().replace(" ", "%20");
        return Map.of(
                "secret", secret,
                "otpauthUrl", otpauth,
                "qrCodeBase64", Base64.getEncoder().encodeToString(image)
        );
    }
}
