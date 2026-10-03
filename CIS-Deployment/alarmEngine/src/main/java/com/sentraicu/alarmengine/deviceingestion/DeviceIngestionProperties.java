package com.sentraicu.alarmengine.deviceingestion;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class DeviceIngestionProperties {

    @Value("${device.ingestion.url:}")
    private String defaultUrl;

    @Value("${device.ingestion.require-https:false}")
    private boolean requireHttps;

    @Value("${device.ingestion.connect-timeout-ms:3000}")
    private int connectTimeoutMs;

    @Value("${device.ingestion.read-timeout-ms:15000}")
    private int readTimeoutMs;

    public String getDefaultUrl() {
        return defaultUrl;
    }

    public boolean isRequireHttps() {
        return requireHttps;
    }

    public int getConnectTimeoutMs() {
        return connectTimeoutMs;
    }

    public int getReadTimeoutMs() {
        return readTimeoutMs;
    }
}
