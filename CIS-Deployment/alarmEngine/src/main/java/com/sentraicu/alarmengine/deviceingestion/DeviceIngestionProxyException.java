package com.sentraicu.alarmengine.deviceingestion;

import org.springframework.http.HttpStatus;

/**
 * Failures talking to a hospital device-ingestion gateway (unreachable,
 * misconfigured URL, timeouts). Mapped to 4xx/5xx by {@code ApiExceptionHandler}.
 */
public class DeviceIngestionProxyException extends RuntimeException {

    private final HttpStatus status;

    public DeviceIngestionProxyException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public DeviceIngestionProxyException(HttpStatus status, String message, Throwable cause) {
        super(message, cause);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
