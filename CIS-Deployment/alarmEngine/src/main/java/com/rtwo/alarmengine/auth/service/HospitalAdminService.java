package com.rtwo.alarmengine.auth.service;

import com.rtwo.alarmengine.auth.entity.HubAuthUserEntity;
import com.rtwo.alarmengine.auth.entity.HubHospitalEntity;
import com.rtwo.alarmengine.auth.entity.HubRoleEntity;
import com.rtwo.alarmengine.auth.entity.HubUserRoleEntity;
import com.rtwo.alarmengine.auth.repo.HubAuthUserRepository;
import com.rtwo.alarmengine.auth.repo.HubHospitalRepository;
import com.rtwo.alarmengine.auth.repo.HubRoleRepository;
import com.rtwo.alarmengine.auth.repo.HubUserRoleRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class HospitalAdminService {

    private final HubAuthUserRepository userRepository;
    private final HubHospitalRepository hospitalRepository;
    private final HubRoleRepository roleRepository;
    private final HubUserRoleRepository userRoleRepository;
    private final JdbcTemplate jdbcTemplate;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public HospitalAdminService(
            HubAuthUserRepository userRepository,
            HubHospitalRepository hospitalRepository,
            HubRoleRepository roleRepository,
            HubUserRoleRepository userRoleRepository,
            JdbcTemplate jdbcTemplate) {
        this.userRepository = userRepository;
        this.hospitalRepository = hospitalRepository;
        this.roleRepository = roleRepository;
        this.userRoleRepository = userRoleRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<Map<String, Object>> listCenters(UUID hospitalId) {
        return jdbcTemplate.query(
                """
                SELECT id AS center_id, name AS center_name, location,
                       COALESCE(status, 'ACTIVE') AS status
                FROM hub_centers
                WHERE hospital_id = ?
                ORDER BY name
                """,
                (rs, rowNum) -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("centerId", rs.getString("center_id"));
                    row.put("name", rs.getString("center_name"));
                    row.put("location", rs.getString("location"));
                    row.put("status", rs.getString("status"));
                    return row;
                },
                hospitalId);
    }

    public List<Map<String, Object>> listUsers(UUID hospitalId) {
        return userRepository.findByHospitalIdOrderByDisplayNameAsc(hospitalId).stream()
                .filter(u -> !u.isSuperAdmin())
                .map(this::toUserDetail)
                .toList();
    }

    @Transactional
    public Map<String, Object> createUser(UUID hospitalId, Map<String, String> body) {
        assertHospitalActive(hospitalId);
        String email = lowerTrim(body.get("email"));
        String displayName = trim(body.get("displayName"));
        String password = body.get("password");
        String roleName = trim(body.get("role"));
        if (email == null || password == null || password.isBlank()) {
            throw new AuthService.AuthException("Email and password are required");
        }
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new AuthService.AuthException("Email already registered");
        }
        if ("HOSPITAL_ADMIN".equalsIgnoreCase(roleName) || "SUPER_ADMIN".equalsIgnoreCase(roleName)) {
            throw new AuthService.AuthException("Cannot assign platform admin role here");
        }

        HubAuthUserEntity user = new HubAuthUserEntity();
        user.setEmail(email);
        user.setUsername(trim(body.get("username")) != null ? trim(body.get("username")) : email.split("@")[0]);
        user.setDisplayName(displayName != null ? displayName : email);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setUserType("HOSPITAL_USER");
        user.setRole(roleName != null ? roleName : "CLINICIAN");
        user.setHospitalId(hospitalId);
        user.setActive(true);
        user.setTotpEnabled(false);
        user.setMustChangePassword(true);
        userRepository.save(user);

        String roleId = body.get("roleId");
        if (roleId != null && !roleId.isBlank()) {
            assignRole(user, hospitalId, UUID.fromString(roleId));
        } else if (roleName != null) {
            roleRepository.findByHospitalIdAndNameIgnoreCase(hospitalId, roleName)
                    .ifPresent(role -> assignRole(user, hospitalId, role.getId()));
        }

        return toUserDetail(user);
    }

    @Transactional
    public Map<String, Object> updateUser(UUID hospitalId, UUID userId, Map<String, String> body) {
        assertHospitalActive(hospitalId);
        HubAuthUserEntity user = requireHospitalUser(hospitalId, userId);
        if (body.containsKey("displayName")) {
            user.setDisplayName(trim(body.get("displayName")));
        }
        if (body.containsKey("active")) {
            user.setActive(Boolean.parseBoolean(body.get("active")));
        }
        if (body.containsKey("role")) {
            String roleName = trim(body.get("role"));
            if (roleName != null) user.setRole(roleName);
        }
        String password = body.get("password");
        if (password != null && !password.isBlank()) {
            user.setPasswordHash(passwordEncoder.encode(password));
            user.setMustChangePassword(true);
        }
        userRepository.save(user);

        if (body.containsKey("roleId")) {
            String roleId = body.get("roleId");
            userRoleRepository.deleteByUserId(userId);
            if (roleId != null && !roleId.isBlank()) {
                assignRole(user, hospitalId, UUID.fromString(roleId));
            }
        }

        return toUserDetail(user);
    }

    public List<Map<String, Object>> listRoles(UUID hospitalId) {
        return roleRepository.findByHospitalIdOrderByNameAsc(hospitalId).stream()
                .map(this::toRoleDetail)
                .toList();
    }

    @Transactional
    public Map<String, Object> createRole(UUID hospitalId, Map<String, Object> body) {
        assertHospitalActive(hospitalId);
        String name = trim((String) body.get("name"));
        if (name == null) {
            throw new AuthService.AuthException("Role name is required");
        }
        if (roleRepository.existsByHospitalIdAndNameIgnoreCase(hospitalId, name)) {
            throw new AuthService.AuthException("Role already exists: " + name);
        }
        HubRoleEntity role = new HubRoleEntity();
        role.setHospitalId(hospitalId);
        role.setName(name);
        role.setDescription(trim((String) body.get("description")));
        role.setSystemRole(false);
        role.setPermissions(parsePermissions(body.get("permissions")));
        roleRepository.save(role);
        return toRoleDetail(role);
    }

    @Transactional
    public Map<String, Object> updateRole(UUID hospitalId, UUID roleId, Map<String, Object> body) {
        assertHospitalActive(hospitalId);
        HubRoleEntity role = roleRepository.findById(roleId)
                .filter(r -> hospitalId.equals(r.getHospitalId()))
                .orElseThrow(() -> new AuthService.AuthException("Role not found"));
        if (body.containsKey("name")) {
            String name = trim((String) body.get("name"));
            if (name != null) role.setName(name);
        }
        if (body.containsKey("description")) {
            role.setDescription(trim((String) body.get("description")));
        }
        if (body.containsKey("permissions")) {
            role.getPermissions().clear();
            role.getPermissions().addAll(parsePermissions(body.get("permissions")));
        }
        roleRepository.save(role);
        return toRoleDetail(role);
    }

    public List<String> permissionCatalog() {
        return PermissionCatalog.HUB_ASSIGNABLE;
    }

    private void assertHospitalActive(UUID hospitalId) {
        HubHospitalEntity hospital = hospitalRepository.findById(hospitalId)
                .orElseThrow(() -> new AuthService.AuthException("Hospital not found"));
        if (!"ACTIVE".equalsIgnoreCase(hospital.getStatus())) {
            throw new AuthService.AuthException("Hospital is inactive. User and role management is disabled.");
        }
    }

    private void assignRole(HubAuthUserEntity user, UUID hospitalId, UUID roleId) {
        HubRoleEntity role = roleRepository.findById(roleId)
                .filter(r -> hospitalId.equals(r.getHospitalId()))
                .orElseThrow(() -> new AuthService.AuthException("Role not found"));
        user.setRole(role.getName());
        userRoleRepository.save(new HubUserRoleEntity(user.getId(), role.getId()));
    }

    private HubAuthUserEntity requireHospitalUser(UUID hospitalId, UUID userId) {
        HubAuthUserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new AuthService.AuthException("User not found"));
        if (!hospitalId.equals(user.getHospitalId())) {
            throw new AuthService.AuthException("User not in your hospital");
        }
        if (user.isSuperAdmin()) {
            throw new AuthService.AuthException("Cannot modify platform admin");
        }
        return user;
    }

    @SuppressWarnings("unchecked")
    private List<String> parsePermissions(Object raw) {
        if (raw == null) return new ArrayList<>();
        if (raw instanceof List<?> list) {
            return PermissionCatalog.sanitizeAssignable(
                    list.stream().map(String::valueOf).toList());
        }
        return new ArrayList<>();
    }

    private Map<String, Object> toUserDetail(HubAuthUserEntity user) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", user.getId().toString());
        map.put("email", user.getEmail());
        map.put("username", user.getUsername());
        map.put("displayName", user.getDisplayName());
        map.put("role", user.getRole());
        map.put("active", user.isActive());
        map.put("mustChangePassword", user.isMustChangePassword());
        map.put("lastLoginAt", user.getLastLoginAt() != null ? user.getLastLoginAt().toString() : null);
        List<HubUserRoleEntity> links = userRoleRepository.findByUserId(user.getId());
        if (!links.isEmpty()) {
            map.put("roleId", links.get(0).getRoleId().toString());
        }
        return map;
    }

    private Map<String, Object> toRoleDetail(HubRoleEntity role) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", role.getId().toString());
        map.put("name", role.getName());
        map.put("description", role.getDescription());
        map.put("systemRole", role.isSystemRole());
        map.put("permissions", role.getPermissions());
        return map;
    }

    private static String trim(String value) {
        if (value == null) return null;
        String t = value.trim();
        return t.isEmpty() ? null : t;
    }

    private static String lowerTrim(String value) {
        String t = trim(value);
        return t != null ? t.toLowerCase(Locale.ROOT) : null;
    }
}
