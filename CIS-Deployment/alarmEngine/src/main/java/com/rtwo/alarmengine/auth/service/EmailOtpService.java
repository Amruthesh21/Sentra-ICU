package com.rtwo.alarmengine.auth.service;

import com.rtwo.alarmengine.auth.config.AuthProperties;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
public class EmailOtpService {

    private static final Logger log = LoggerFactory.getLogger(EmailOtpService.class);

    private final AuthProperties properties;
    private final JavaMailSender mailSender;

    public EmailOtpService(AuthProperties properties, ObjectProvider<JavaMailSender> mailSenderProvider) {
        this.properties = properties;
        this.mailSender = mailSenderProvider.getIfAvailable();
    }

    public boolean sendPasswordResetCode(String toEmail, String code) {
        if (!properties.getMail().isEnabled() || mailSender == null) {
            log.warn("SMTP not configured — password reset code not emailed to {}", maskEmail(toEmail));
            return false;
        }

        String from = properties.getMail().getFrom();
        String issuer = properties.getMfa().getIssuer();
        String subject = issuer + " — Password reset code";
        int expiry = properties.getOtp().getResetExpiryMinutes();
        String text = "Your password reset code is: " + code + "\n\n"
                + "This code expires in " + expiry + " minutes.\n\n"
                + "If you did not request this, ignore this email.\n\n"
                + "— Sentra ICU";
        String html = """
                <div style="font-family:Segoe UI,Arial,sans-serif;max-width:480px;color:#0f2d5c">
                  <p style="font-size:18px;font-weight:700;margin:0 0 12px">%s — Password reset</p>
                  <p style="margin:0 0 16px;color:#475569">Enter this code to choose a new password:</p>
                  <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:0 0 16px">%s</p>
                  <p style="margin:0;color:#64748b;font-size:14px">Expires in %d minutes. Do not share this code.</p>
                </div>
                """.formatted(issuer, code, expiry);

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(new InternetAddress(from, issuer));
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(text, html);
            mailSender.send(message);
            log.info("Password reset code emailed to {}", maskEmail(toEmail));
            return true;
        } catch (Exception e) {
            log.error("Failed to send password reset email to {}: {}", toEmail, e.getMessage());
            return false;
        }
    }

    /** @return true if the OTP was handed off to the mail server successfully */
    public boolean sendLoginOtp(String toEmail, String otp) {
        if (!properties.getMail().isEnabled() || mailSender == null) {
            log.warn("SMTP not configured — MFA OTP not emailed to {}", maskEmail(toEmail));
            return false;
        }

        String from = properties.getMail().getFrom();
        String issuer = properties.getMfa().getIssuer();
        String subject = issuer + " — Your sign-in code";
        String text = "Your Sentra ICU verification code is: " + otp + "\n\n"
                + "This code expires in " + properties.getOtp().getExpiryMinutes() + " minutes.\n\n"
                + "If you did not request this, ignore this email.\n\n"
                + "— Sentra ICU";
        String html = """
                <div style="font-family:Segoe UI,Arial,sans-serif;max-width:480px;color:#0f2d5c">
                  <p style="font-size:18px;font-weight:700;margin:0 0 12px">%s</p>
                  <p style="margin:0 0 16px;color:#475569">Use this code to complete sign-in:</p>
                  <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:0 0 16px">%s</p>
                  <p style="margin:0;color:#64748b;font-size:14px">Expires in %d minutes. Do not share this code.</p>
                </div>
                """.formatted(issuer, otp, properties.getOtp().getExpiryMinutes());

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(new InternetAddress(from, issuer));
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(text, html);
            mailSender.send(message);
            log.info("MFA OTP emailed to {} from {}", maskEmail(toEmail), maskEmail(from));
            return true;
        } catch (Exception e) {
            log.error("Failed to send MFA email to {}: {} — cause: {}",
                    toEmail, e.getMessage(), rootCause(e));
            return false;
        }
    }

    public static String maskEmail(String email) {
        if (email == null || !email.contains("@")) return "****";
        String[] parts = email.split("@", 2);
        String local = parts[0];
        String masked = local.length() <= 1 ? "*" : local.charAt(0) + "****";
        return masked + "@" + parts[1];
    }

    private static String rootCause(Throwable e) {
        Throwable c = e;
        while (c.getCause() != null) c = c.getCause();
        return c.getMessage() != null ? c.getMessage() : c.getClass().getSimpleName();
    }
}
