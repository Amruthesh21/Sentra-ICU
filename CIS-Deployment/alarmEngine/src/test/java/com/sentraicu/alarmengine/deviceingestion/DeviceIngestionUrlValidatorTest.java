package com.sentraicu.alarmengine.deviceingestion;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DeviceIngestionUrlValidatorTest {

    @Test
    void blankBecomesNull() {
        assertNull(DeviceIngestionUrlValidator.normalize("  ", false));
        assertNull(DeviceIngestionUrlValidator.normalize(null, false));
    }

    @Test
    void acceptsHttpOriginAndStripsSlash() {
        assertEquals(
                "http://10.20.0.10:9050",
                DeviceIngestionUrlValidator.normalize("http://10.20.0.10:9050/", false));
    }

    @Test
    void acceptsHttpsAndDockerHostname() {
        assertEquals(
                "https://gw.hospital.example",
                DeviceIngestionUrlValidator.normalize("https://gw.hospital.example", false));
        assertEquals(
                "http://cis-device-ingestion:9050",
                DeviceIngestionUrlValidator.normalize("http://CIS-device-ingestion:9050", false));
    }

    @Test
    void rejectsCredentialsPathQueryAndMetadata() {
        assertThrows(IllegalArgumentException.class,
                () -> DeviceIngestionUrlValidator.normalize("http://user:pass@10.0.0.1:9050", false));
        assertThrows(IllegalArgumentException.class,
                () -> DeviceIngestionUrlValidator.normalize("http://10.0.0.1:9050/api", false));
        assertThrows(IllegalArgumentException.class,
                () -> DeviceIngestionUrlValidator.normalize("http://10.0.0.1:9050?x=1", false));
        assertThrows(IllegalArgumentException.class,
                () -> DeviceIngestionUrlValidator.normalize("file:///etc/passwd", false));
        assertThrows(IllegalArgumentException.class,
                () -> DeviceIngestionUrlValidator.normalize("http://169.254.169.254/", false));
    }

    @Test
    void requireHttpsRejectsHttp() {
        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> DeviceIngestionUrlValidator.normalize("http://10.20.0.10:9050", true));
        assertTrue(ex.getMessage().toLowerCase().contains("https"));
    }

    @Test
    void remainingPathStripsProxyPrefix() {
        assertEquals("/api/bed-map", DeviceIngestionProxyService.remainingPath("/api/device-ingestion/api/bed-map"));
        assertEquals("/", DeviceIngestionProxyService.remainingPath("/api/device-ingestion"));
        assertEquals("/api/waveforms/BED-01", DeviceIngestionProxyService.remainingPath("/api/device-ingestion/api/waveforms/BED-01"));
    }
}
