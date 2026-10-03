package com.sentraicu.alarmengine.controller;

import com.sentraicu.alarmengine.auth.service.AuthService;
import com.sentraicu.alarmengine.deviceingestion.DeviceIngestionProxyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> badRequest(IllegalArgumentException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", ex.getMessage());
        body.put("status", "error");
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    @ExceptionHandler(AuthService.AuthException.class)
    public ResponseEntity<Map<String, Object>> authError(AuthService.AuthException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", ex.getMessage());
        body.put("status", "error");
        HttpStatus status = HttpStatus.resolve(ex.getHttpStatus());
        if (status == null) status = HttpStatus.UNAUTHORIZED;
        return ResponseEntity.status(status).body(body);
    }

    @ExceptionHandler(DeviceIngestionProxyException.class)
    public ResponseEntity<Map<String, Object>> deviceGateway(DeviceIngestionProxyException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", ex.getMessage());
        body.put("status", "error");
        HttpStatus status = ex.getStatus() != null ? ex.getStatus() : HttpStatus.BAD_GATEWAY;
        return ResponseEntity.status(status).body(body);
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, Object>> conflict(IllegalStateException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", ex.getMessage());
        body.put("status", "error");
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }
}
