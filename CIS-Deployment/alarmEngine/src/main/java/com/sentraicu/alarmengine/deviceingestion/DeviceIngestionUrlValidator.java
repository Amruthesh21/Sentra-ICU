package com.sentraicu.alarmengine.deviceingestion;

import java.net.IDN;
import java.net.InetAddress;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import java.util.Set;

/**
 * Guards the super-admin-configured gateway URL against SSRF. The cloud
 * alarm-engine will HTTP-proxy Hub Connect-a-device / waveform calls to
 * whatever origin is stored on {@code hub_hospitals.device_ingestion_url},
 * so that value must be an origin only (no path, no credentials) and must
 * not point at cloud-metadata endpoints.
 */
public final class DeviceIngestionUrlValidator {

    private static final Set<String> BLOCKED_HOSTS = Set.of(
            "169.254.169.254",
            "metadata.google.internal",
            "metadata",
            "metadata.google.com"
    );

    private DeviceIngestionUrlValidator() {}

    /**
     * @param raw        user-supplied URL (blank/null means "clear / use default")
     * @param requireHttps when true, reject {@code http://} (LAN gateways use http)
     * @return trimmed origin with no trailing slash, or {@code null} if blank
     */
    public static String normalize(String raw, boolean requireHttps) {
        if (raw == null) return null;
        String trimmed = raw.trim();
        if (trimmed.isEmpty()) return null;

        URI uri;
        try {
            uri = new URI(trimmed);
        } catch (URISyntaxException e) {
            throw new IllegalArgumentException("Device gateway URL is not a valid URI");
        }

        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if (!"http".equals(scheme) && !"https".equals(scheme)) {
            throw new IllegalArgumentException("Device gateway URL must be http or https");
        }
        if (requireHttps && !"https".equals(scheme)) {
            throw new IllegalArgumentException("Device gateway URL must be https in this deployment");
        }
        if (uri.getUserInfo() != null && !uri.getUserInfo().isBlank()) {
            throw new IllegalArgumentException("Device gateway URL must not include credentials");
        }
        if (uri.getQuery() != null || uri.getFragment() != null) {
            throw new IllegalArgumentException("Device gateway URL must be an origin only (no query or fragment)");
        }
        String path = uri.getPath();
        if (path != null && !path.isEmpty() && !"/".equals(path)) {
            throw new IllegalArgumentException(
                    "Device gateway URL must be an origin only, e.g. https://gw.hospital.example:9050");
        }
        String host = uri.getHost();
        if (host == null || host.isBlank()) {
            throw new IllegalArgumentException("Device gateway URL is missing a host");
        }
        host = host.toLowerCase(Locale.ROOT);
        if (BLOCKED_HOSTS.contains(host) || BLOCKED_HOSTS.contains(asciiHost(host))) {
            throw new IllegalArgumentException("Device gateway URL host is not allowed");
        }
        if (isLinkLocalMetadata(host)) {
            throw new IllegalArgumentException("Device gateway URL host is not allowed");
        }
        int port = uri.getPort();
        if (port == 0 || port < -1) {
            throw new IllegalArgumentException("Device gateway URL port is invalid");
        }

        StringBuilder origin = new StringBuilder();
        origin.append(scheme).append("://").append(host);
        if (port != -1) {
            origin.append(':').append(port);
        }
        return origin.toString();
    }

    private static String asciiHost(String host) {
        try {
            return IDN.toASCII(host).toLowerCase(Locale.ROOT);
        } catch (Exception e) {
            return host;
        }
    }

    static boolean isLinkLocalMetadata(String host) {
        // Literal IPs only — never resolve hostnames here (save would hang on DNS).
        if (!host.matches("\\d{1,3}(?:\\.\\d{1,3}){3}")) {
            return false;
        }
        try {
            InetAddress addr = InetAddress.getByName(host);
            byte[] bytes = addr.getAddress();
            if (bytes.length == 4) {
                int a = bytes[0] & 0xff;
                int b = bytes[1] & 0xff;
                // 169.254.0.0/16 — AWS/GCP/Azure instance metadata + link-local
                return a == 169 && b == 254;
            }
        } catch (Exception ignored) {
            return false;
        }
        return false;
    }
}
