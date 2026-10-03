package com.sentraicu.alarmengine.auth.controller;

import com.sentraicu.alarmengine.auth.entity.HubAuthUserEntity;
import com.sentraicu.alarmengine.auth.security.AuthSecurity;
import com.sentraicu.alarmengine.auth.service.AuditLogService;
import com.sentraicu.alarmengine.auth.service.HospitalAdminService;
import com.sentraicu.alarmengine.auth.service.ProfilePhotoService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/hospital-admin")
public class HospitalAdminController {

    private final AuthSecurity authSecurity;
    private final HospitalAdminService hospitalAdminService;
    private final ProfilePhotoService photoService;
    private final AuditLogService auditLogService;

    public HospitalAdminController(
            AuthSecurity authSecurity,
            HospitalAdminService hospitalAdminService,
            ProfilePhotoService photoService,
            AuditLogService auditLogService) {
        this.authSecurity = authSecurity;
        this.hospitalAdminService = hospitalAdminService;
        this.photoService = photoService;
        this.auditLogService = auditLogService;
    }

    @GetMapping("/audit-logs")
    public List<Map<String, Object>> auditLogs(
            @RequestParam(required = false, defaultValue = "ALL") String category,
            @RequestParam(required = false, defaultValue = "200") int limit,
            HttpServletRequest request) {
        HubAuthUserEntity admin = authSecurity.requireHospitalAdmin(request);
        UUID hospitalId = resolveHospitalId(request, admin);
        return auditLogService.listForHospital(hospitalId, category, limit);
    }

    @GetMapping("/users")
    public List<Map<String, Object>> listUsers(HttpServletRequest request) {
        HubAuthUserEntity admin = authSecurity.requireHospitalAdmin(request);
        UUID hospitalId = resolveHospitalId(request, admin);
        return hospitalAdminService.listUsers(hospitalId);
    }

    @PostMapping("/users")
    public ResponseEntity<Map<String, Object>> createUser(
            @RequestBody Map<String, String> body,
            HttpServletRequest request) {
        HubAuthUserEntity admin = authSecurity.requireHospitalAdmin(request);
        assertAdminCanManage(admin);
        UUID hospitalId = resolveHospitalId(request, admin);
        Map<String, Object> created = hospitalAdminService.createUser(hospitalId, body);
        auditLogService.record(
                admin,
                hospitalId,
                "HOSPITAL",
                "USER_CREATED",
                "Created user " + body.get("email"),
                clientIp(request));
        return ResponseEntity.ok(created);
    }

    @PatchMapping("/users/{userId}")
    public Map<String, Object> updateUser(
            @PathVariable UUID userId,
            @RequestBody Map<String, String> body,
            HttpServletRequest request) {
        HubAuthUserEntity admin = authSecurity.requireHospitalAdmin(request);
        assertAdminCanManage(admin);
        UUID hospitalId = resolveHospitalId(request, admin);
        Map<String, Object> updated = hospitalAdminService.updateUser(hospitalId, userId, body);
        auditLogService.record(
                admin,
                hospitalId,
                "HOSPITAL",
                "USER_UPDATED",
                "Updated user " + userId,
                clientIp(request));
        return updated;
    }

    @GetMapping("/users/{userId}/photo")
    public ResponseEntity<byte[]> getUserPhoto(
            @PathVariable UUID userId,
            HttpServletRequest request) {
        HubAuthUserEntity admin = authSecurity.requireHospitalAdmin(request);
        UUID hospitalId = resolveHospitalId(request, admin);
        return photoService.toResponse(
                hospitalAdminService.getUserPhoto(hospitalId, userId).orElse(null));
    }

    @PostMapping(path = "/users/{userId}/photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> uploadUserPhoto(
            @PathVariable UUID userId,
            @RequestParam("file") MultipartFile file,
            HttpServletRequest request) throws IOException {
        HubAuthUserEntity admin = authSecurity.requireHospitalAdmin(request);
        assertAdminCanManage(admin);
        UUID hospitalId = resolveHospitalId(request, admin);
        hospitalAdminService.saveUserPhoto(hospitalId, userId, file);
        auditLogService.record(
                admin,
                hospitalId,
                "HOSPITAL",
                "USER_PHOTO_UPDATED",
                "Updated photo for user " + userId,
                clientIp(request));
        return Map.of("ok", true, "hasPhoto", true);
    }

    @DeleteMapping("/users/{userId}/photo")
    public Map<String, Object> deleteUserPhoto(
            @PathVariable UUID userId,
            HttpServletRequest request) {
        HubAuthUserEntity admin = authSecurity.requireHospitalAdmin(request);
        assertAdminCanManage(admin);
        UUID hospitalId = resolveHospitalId(request, admin);
        hospitalAdminService.deleteUserPhoto(hospitalId, userId);
        auditLogService.record(
                admin,
                hospitalId,
                "HOSPITAL",
                "USER_PHOTO_REMOVED",
                "Removed photo for user " + userId,
                clientIp(request));
        return Map.of("ok", true, "hasPhoto", false);
    }

    @GetMapping("/roles")
    public List<Map<String, Object>> listRoles(HttpServletRequest request) {
        HubAuthUserEntity admin = authSecurity.requireHospitalAdmin(request);
        UUID hospitalId = resolveHospitalId(request, admin);
        return hospitalAdminService.listRoles(hospitalId);
    }

    @PostMapping("/roles")
    public ResponseEntity<Map<String, Object>> createRole(
            @RequestBody Map<String, Object> body,
            HttpServletRequest request) {
        HubAuthUserEntity admin = authSecurity.requireHospitalAdmin(request);
        assertAdminCanManage(admin);
        UUID hospitalId = resolveHospitalId(request, admin);
        Map<String, Object> created = hospitalAdminService.createRole(hospitalId, body);
        auditLogService.record(
                admin,
                hospitalId,
                "HOSPITAL",
                "ROLE_CREATED",
                "Created role " + body.get("name"),
                clientIp(request));
        return ResponseEntity.ok(created);
    }

    @PatchMapping("/roles/{roleId}")
    public Map<String, Object> updateRole(
            @PathVariable UUID roleId,
            @RequestBody Map<String, Object> body,
            HttpServletRequest request) {
        HubAuthUserEntity admin = authSecurity.requireHospitalAdmin(request);
        assertAdminCanManage(admin);
        UUID hospitalId = resolveHospitalId(request, admin);
        Map<String, Object> updated = hospitalAdminService.updateRole(hospitalId, roleId, body);
        auditLogService.record(
                admin,
                hospitalId,
                "HOSPITAL",
                "ROLE_UPDATED",
                "Updated role " + roleId,
                clientIp(request));
        return updated;
    }

    @GetMapping("/permissions")
    public List<String> permissionCatalog(HttpServletRequest request) {
        authSecurity.requireHospitalAdmin(request);
        return hospitalAdminService.permissionCatalog();
    }

    @GetMapping("/centers")
    public List<Map<String, Object>> listCenters(HttpServletRequest request) {
        HubAuthUserEntity admin = authSecurity.requireHospitalAdmin(request);
        UUID hospitalId = resolveHospitalId(request, admin);
        return hospitalAdminService.listCenters(hospitalId);
    }

    private UUID resolveHospitalId(HttpServletRequest request, HubAuthUserEntity user) {
        UUID hospitalId = authSecurity.hospitalScope(user);
        if (hospitalId == null) {
            throw new com.sentraicu.alarmengine.auth.service.AuthService.AuthException("Select a hospital context");
        }
        return hospitalId;
    }

    private void assertAdminCanManage(HubAuthUserEntity admin) {
        if (!admin.isSuperAdmin() && !admin.isActive()) {
            throw new com.sentraicu.alarmengine.auth.service.AuthService.AuthException(
                    "Your account is inactive. User management is disabled.");
        }
    }

    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
