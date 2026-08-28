package com.sentraicu.alarmengine.auth.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.util.StringUtils;

import java.util.Properties;

@Configuration
@ConditionalOnProperty(name = "hub.auth.mail.enabled", havingValue = "true")
public class MailConfig {

    @Bean
    public JavaMailSender javaMailSender(AuthProperties authProperties, Environment env) {
        String host = env.getProperty("spring.mail.host", "");
        int port = env.getProperty("spring.mail.port", Integer.class, 587);
        String username = env.getProperty("spring.mail.username", "");
        String password = env.getProperty("spring.mail.password", "");

        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(host);
        sender.setPort(port);
        sender.setUsername(username);
        sender.setPassword(password);
        if (StringUtils.hasText(authProperties.getMail().getFrom())) {
            sender.setDefaultEncoding("UTF-8");
        }

        Properties props = sender.getJavaMailProperties();
        props.put("mail.transport.protocol", "smtp");
        props.put("mail.smtp.auth", "true");
        props.put("mail.smtp.connectiontimeout", "15000");
        props.put("mail.smtp.timeout", "15000");
        props.put("mail.smtp.writetimeout", "15000");
        props.put("mail.smtp.ssl.protocols", "TLSv1.2");

        boolean ssl = Boolean.parseBoolean(env.getProperty("SMTP_SSL", "false"));
        if (ssl || port == 465) {
            props.put("mail.smtp.ssl.enable", "true");
            props.put("mail.smtp.socketFactory.port", String.valueOf(port));
            props.put("mail.smtp.socketFactory.class", "javax.net.ssl.SSLSocketFactory");
            props.put("mail.smtp.socketFactory.fallback", "false");
        } else {
            props.put("mail.smtp.starttls.enable", "true");
            props.put("mail.smtp.starttls.required", "true");
        }

        String trust = env.getProperty("SMTP_SSL_TRUST", host);
        if (StringUtils.hasText(trust)) {
            props.put("mail.smtp.ssl.trust", trust);
        }

        return sender;
    }
}
