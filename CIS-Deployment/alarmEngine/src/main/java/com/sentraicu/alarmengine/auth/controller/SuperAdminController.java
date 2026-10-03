package com.sentraicu.alarmengine.auth.controller;

import com.sentraicu.alarmengine.auth.entity.HubAuthUserEntity;
import com.sentraicu.alarmengine.auth.security.AuthSecurity;
import com.sentraicu.alarmengine.auth.service.AuditLogService;
import com.sentraicu.alarmengine.auth.service.SuperAdminService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/super-admin")
public class SuperAdminController {

    private final AuthSecurity authSecurity;
    private final SuperAdminService superAdminService;
    private final AuditLogService auditLogService;

    public SuperAdminController(
            AuthSecurity authSecurity,
            SuperAdminService superAdminService,
            AuditLogService auditLogService) {
        this.authSecurity = authSecurity;
        this.superAdminService = superAdminService;
        this.auditLogService = auditLogService;
    }

    @GetMapping("/platform/overview")
    public Map<String, Object> platformOverview(HttpServletRequest request) {
        authSecurity.requireSuperAdmin(request);
        return superAdminService.getPlatformOverview();
    }

    @GetMapping("/platform/analytics")
    public Map<String, Object> platformAnalytics(HttpServletRequest request) {
        authSecurity.requireSuperAdmin(request);
        return auditLogService.platformAnalytics();
    }

    @GetMapping("/audit-logs")
    public List<Map<String, Object>> auditLogs(
            @RequestParam(required = false) UUID hospitalId,
            @RequestParam(required = false, defaultValue = "ALL") String category,
            @RequestParam(required = false, defaultValue = "200") int limit,
            HttpServletRequest request) {
        authSecurity.requireSuperAdmin(request);
        return auditLogService.listForSuperAdmin(hospitalId, category, limit);
    }

    @GetMapping("/hospitals")
    public List<Map<String, Object>> listHospitals(HttpServletRequest request) {
        authSecurity.requireSuperAdmin(request);
        return superAdminService.listHospitals();
    }

    @GetMapping("/hospitals/{hospitalId}")
    public Map<String, Object> getHospital(@PathVariable UUID hospitalId, HttpServletRequest request) {
        authSecurity.requireSuperAdmin(request);
        return superAdminService.getHospital(hospitalId);
    }

    @PostMapping("/hospitals")
    public ResponseEntity<Map<String, Object>> createHospital(
            @RequestBody Map<String, String> body,
            HttpServletRequest request) {
        HubAuthUserEntity actor = authSecurity.requireSuperAdmin(request);
        Map<String, Object> result = superAdminService.createHospital(body);
        auditLogService.record(
                actor,
                UUID.fromString(String.valueOf(result.get("id"))),
                "PLATFORM",
                "HOSPITAL_CREATED",
                "Created hospital " + body.get("name"),
                clientIp(request));
        return ResponseEntity.ok(result);
    }

    @GetMapping("/centers-admins")
    public Map<String, Object> listCentersAndAdmins(HttpServletRequest request) {
        authSecurity.requireSuperAdmin(request);
        return superAdminService.listCentersAndAdmins();
    }

    @PostMapping("/hospitals/{hospitalId}/centers")
    public Map<String, Object> linkCenter(
            @PathVariable UUID hospitalId,
            @RequestBody Map<String, String> body,
            HttpServletRequest request) {
        HubAuthUserEntity actor = authSecurity.requireSuperAdmin(request);
        Map<String, Object> result = superAdminService.linkCenterToHospital(hospitalId, body);
        auditLogService.record(
                actor,
                hospitalId,
                "PLATFORM",
                "CENTER_LINKED",
                "Linked center " + body.get("centerId"),
                clientIp(request));
        return result;
    }

    @PatchMapping("/hospitals/{hospitalId}")
    public Map<String, Object> updateHospital(
            @PathVariable UUID hospitalId,
            @RequestBody Map<String, String> body,
            HttpServletRequest request) {
        HubAuthUserEntity actor = authSecurity.requireSuperAdmin(request);
        Map<String, Object> result = superAdminService.updateHospitalStatus(hospitalId, body);
        boolean urlChanged = body.containsKey("deviceIngestionUrl");
        boolean statusChanged = body.get("status") != null && !body.get("status").isBlank();
        String action = urlChanged && !statusChanged ? "HOSPITAL_GATEWAY_UPDATED" : "HOSPITAL_STATUS_CHANGED";
        String detail;
        if (urlChanged && statusChanged) {
            detail = "Updated status to " + body.get("status") + " and device gateway URL";
        } else if (urlChanged) {
            detail = "Updated device gateway URL";
        } else {
            detail = "Status set to " + body.get("status");
        }
        auditLogService.record(actor, hospitalId, "PLATFORM", action, detail, clientIp(request));
        return result;
    }

    @DeleteMapping("/hospitals/{hospitalId}")
    public Map<String, Object> deleteHospital(
            @PathVariable UUID hospitalId,
            HttpServletRequest request) {
        HubAuthUserEntity actor = authSecurity.requireSuperAdmin(request);
        superAdminService.deleteHospital(hospitalId);
        auditLogService.record(
                actor,
                hospitalId,
                "PLATFORM",
                "HOSPITAL_DEACTIVATED",
                "Hospital deactivated",
                clientIp(request));
        return Map.of("ok", true);
    }

    @PatchMapping("/hospitals/{hospitalId}/centers/{centerId}")
    public Map<String, Object> updateCenter(
            @PathVariable UUID hospitalId,
            @PathVariable String centerId,
            @RequestBody Map<String, String> body,
            HttpServletRequest request) {
        HubAuthUserEntity actor = authSecurity.requireSuperAdmin(request);
        Map<String, Object> result = superAdminService.updateCenterStatus(hospitalId, centerId, body);
        auditLogService.record(
                actor,
                hospitalId,
                "PLATFORM",
                "CENTER_STATUS_CHANGED",
                "Center " + centerId + " status " + body.get("status"),
                clientIp(request));
        return result;
    }

    @DeleteMapping("/hospitals/{hospitalId}/centers/{centerId}")
    public Map<String, Object> deleteCenter(
            @PathVariable UUID hospitalId,
            @PathVariable String centerId,
            HttpServletRequest request) {
        HubAuthUserEntity actor = authSecurity.requireSuperAdmin(request);
        superAdminService.deleteCenter(hospitalId, centerId);
        auditLogService.record(
                actor,
                hospitalId,
                "PLATFORM",
                "CENTER_REMOVED",
                "Center " + centerId + " unlinked",
                clientIp(request));
        return Map.of("ok", true);
    }

    @PostMapping("/hospitals/{hospitalId}/admins")
    public ResponseEntity<Map<String, Object>> createHospitalAdmin(
            @PathVariable UUID hospitalId,
            @RequestBody Map<String, String> body,
            HttpServletRequest request) {
        HubAuthUserEntity actor = authSecurity.requireSuperAdmin(request);
        Map<String, Object> result = superAdminService.createHospitalAdminUser(hospitalId, body);
        auditLogService.record(
                actor,
                hospitalId,
                "PLATFORM",
                "HOSPITAL_ADMIN_CREATED",
                "Created admin " + body.get("email"),
                clientIp(request));
        return ResponseEntity.ok(result);
    }

    @PatchMapping("/hospitals/{hospitalId}/admins/{userId}")
    public Map<String, Object> updateHospitalAdmin(
            @PathVariable UUID hospitalId,
            @PathVariable UUID userId,
            @RequestBody Map<String, String> body,
            HttpServletRequest request) {
        HubAuthUserEntity actor = authSecurity.requireSuperAdmin(request);
        Map<String, Object> result = superAdminService.updateHospitalAdmin(hospitalId, userId, body);
        auditLogService.record(
                actor,
                hospitalId,
                "PLATFORM",
                "HOSPITAL_ADMIN_UPDATED",
                "Updated admin " + userId,
                clientIp(request));
        return result;
    }

    @PostMapping("/hospitals/{hospitalId}/admins/{userId}/reset-temp-password")
    public ResponseEntity<Map<String, Object>> resetHospitalAdminTempPassword(
            @PathVariable UUID hospitalId,
            @PathVariable UUID userId,
            @RequestBody(required = false) Map<String, String> body,
            HttpServletRequest request) {
        HubAuthUserEntity actor = authSecurity.requireSuperAdmin(request);
        Map<String, Object> result = superAdminService.resetHospitalAdminTempPassword(hospitalId, userId, body);
        auditLogService.record(
                actor,
                hospitalId,
                "PLATFORM",
                "HOSPITAL_ADMIN_TEMP_PASSWORD_RESET",
                "Reset temporary password for admin " + userId,
                clientIp(request));
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/hospitals/{hospitalId}/admins/{userId}")
    public Map<String, Object> deleteHospitalAdmin(
            @PathVariable UUID hospitalId,
            @PathVariable UUID userId,
            HttpServletRequest request) {
        HubAuthUserEntity actor = authSecurity.requireSuperAdmin(request);
        superAdminService.deleteHospitalAdmin(hospitalId, userId);
        auditLogService.record(
                actor,
                hospitalId,
                "PLATFORM",
                "HOSPITAL_ADMIN_REMOVED",
                "Removed admin " + userId,
                clientIp(request));
        return Map.of("ok", true);
    }

    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
