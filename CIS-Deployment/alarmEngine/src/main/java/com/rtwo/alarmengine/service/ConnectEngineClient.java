package com.rtwo.alarmengine.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class ConnectEngineClient {

    private static final Logger log = LoggerFactory.getLogger(ConnectEngineClient.class);

    private final RestTemplate restTemplate;
    private final String baseUrl;
    private final ConnectEngineSyncService syncService;

    public ConnectEngineClient(
            @Value("${connect.engine.url:http://CIS-Deployment-connect-engine:9010}") String baseUrl,
            ConnectEngineSyncService syncService) {
        this.restTemplate = new RestTemplate();
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        this.syncService = syncService;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> retrieve() {
        try {
            return restTemplate.getForObject(baseUrl + "/retrieve", Map.class);
        } catch (Exception e) {
            log.warn("Connect Engine retrieve failed: {}", e.getMessage());
            return Map.of();
        }
    }

    /**
     * MongoDB is saved before this call. Hub is always synced; CE catches up via debounced batch restart.
     */
    public boolean pushCenterUpdate(String centerName, String location, List<Map<String, Object>> beds) {
        if (pushUpdateRequest(centerName, location, beds)) {
            return true;
        }
        return syncService.hubSynced();
    }

    private boolean pushUpdateRequest(String centerName, String location, List<Map<String, Object>> beds) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("name", centerName);
        payload.put("location", location);
        payload.put("beds", beds);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);

        try {
            ResponseEntity<String> response = restTemplate.postForEntity(baseUrl + "/update", entity, String.class);
            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("Connect Engine updated via API: {} beds", beds.size());
                return true;
            }
            log.debug("Connect Engine /update returned {} — using MongoDB + batch sync", response.getStatusCode());
            return false;
        } catch (Exception e) {
            log.debug("Connect Engine /update unavailable — Hub uses MongoDB ({})", e.getMessage());
            return false;
        }
    }
}
