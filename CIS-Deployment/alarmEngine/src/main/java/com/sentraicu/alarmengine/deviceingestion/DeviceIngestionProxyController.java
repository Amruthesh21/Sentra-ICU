package com.sentraicu.alarmengine.deviceingestion;

import com.sentraicu.alarmengine.auth.security.AuthSecurity;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

/**
 * Cloud-side reverse proxy for the hospital device-ingestion HTTP API.
 * Hub Connect-a-device and live waveforms call {@code /device-ingestion/*}
 * (nginx) which lands here as {@code /api/device-ingestion/*}; this forwards
 * the caller's Hub JWT to the hospital gateway over VPN.
 */
@RestController
@RequestMapping("/api/device-ingestion")
public class DeviceIngestionProxyController {

    private final AuthSecurity authSecurity;
    private final DeviceIngestionProxyService proxyService;

    public DeviceIngestionProxyController(AuthSecurity authSecurity, DeviceIngestionProxyService proxyService) {
        this.authSecurity = authSecurity;
        this.proxyService = proxyService;
    }

    @RequestMapping(value = "/**", method = {
            RequestMethod.GET,
            RequestMethod.POST,
            RequestMethod.PUT,
            RequestMethod.PATCH,
            RequestMethod.DELETE
    })
    public ResponseEntity<byte[]> proxy(
            HttpServletRequest request,
            @RequestBody(required = false) byte[] body) {
        authSecurity.requireUser(request);
        return proxyService.forward(request, body);
    }
}
