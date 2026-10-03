package com.sentraicu.alarmengine.deviceingestion;

import com.sentraicu.alarmengine.auth.entity.HubHospitalEntity;
import com.sentraicu.alarmengine.auth.repo.HubHospitalRepository;
import com.sentraicu.alarmengine.auth.security.AuthPrincipal;
import com.sentraicu.alarmengine.auth.security.JwtAuthFilter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Picks the hospital device-ingestion origin for this Hub session.
 * Hospital users always go to their tenant's stored URL (falling back to
 * {@code DEVICE_INGESTION_URL} so a laptop all-in-one still works with no
 * super-admin config). Super-admins have no hospital and use the env default.
 */
@Component
public class DeviceIngestionGatewayResolver {

    private final HubHospitalRepository hospitalRepository;
    private final DeviceIngestionProperties properties;

    public DeviceIngestionGatewayResolver(
            HubHospitalRepository hospitalRepository,
            DeviceIngestionProperties properties) {
        this.hospitalRepository = hospitalRepository;
        this.properties = properties;
    }

    public String resolve(HttpServletRequest request) {
        AuthPrincipal principal = (AuthPrincipal) request.getAttribute(JwtAuthFilter.AUTH_ATTR);
        UUID hospitalId = principal == null ? null : principal.getHospitalId();
        if (hospitalId != null) {
            HubHospitalEntity hospital = hospitalRepository.findById(hospitalId).orElse(null);
            if (hospital != null) {
                String perHospital = blankToNull(hospital.getDeviceIngestionUrl());
                if (perHospital != null) {
                    return DeviceIngestionUrlValidator.normalize(perHospital, properties.isRequireHttps());
                }
            }
        }
        String fallback = blankToNull(properties.getDefaultUrl());
        if (fallback != null) {
            return DeviceIngestionUrlValidator.normalize(fallback, false);
        }
        throw new DeviceIngestionProxyException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "Device gateway is not configured for this hospital. "
                        + "A platform administrator must set the hospital's device gateway URL.");
    }

    private static String blankToNull(String value) {
        if (value == null) return null;
        String t = value.trim();
        return t.isEmpty() ? null : t;
    }
}
