package com.sentraicu.alarmengine.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.Arrays;

/** Single source of truth for API CORS policy — a second, more permissive
 * config used to live in RabbitMQConfig.java (allowedOrigins("*")); both
 * are consolidated here. */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    private static final Logger log = LoggerFactory.getLogger(WebConfig.class);

    @Value("${hub.cors.allowed-origins}")
    private String allowedOrigins;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        String[] origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(o -> !o.isEmpty())
                .toArray(String[]::new);
        if (origins.length == 0) {
            log.warn("hub.cors.allowed-origins is empty — no cross-origin API access will be permitted. "
                    + "Set HUB_CORS_ALLOWED_ORIGINS to the Hub/PWA origins that need direct API access.");
        } else {
            log.info("CORS allowed origins: {}", String.join(", ", origins));
        }
        registry.addMapping("/api/**")
                .allowedOrigins(origins)
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS");
    }
}
