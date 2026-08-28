package com.sentraicu.alarmengine.auth.service;

import com.sentraicu.alarmengine.hub.HubCenterIds;
import com.sentraicu.alarmengine.auth.entity.HubAuthUserEntity;
import com.sentraicu.alarmengine.auth.entity.HubHospitalEntity;
import com.sentraicu.alarmengine.auth.entity.HubRoleEntity;
import com.sentraicu.alarmengine.auth.repo.HubAuthUserRepository;
import com.sentraicu.alarmengine.auth.repo.HubHospitalRepository;
import com.sentraicu.alarmengine.auth.repo.HubRoleRepository;
import com.sentraicu.alarmengine.auth.repo.HubUserRoleRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class SuperAdminService {

    private final HubHospitalRepository hospitalRepository;
    private final HubAuthUserRepository userRepository;
    private final HubRoleRepository roleRepository;
    private final HubUserRoleRepository userRoleRepository;
    private final JdbcTemplate jdbcTemplate;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public SuperAdminService(
            HubHospitalRepository hospitalRepository,
            HubAuthUserRepository userRepository,
            HubRoleRepository roleRepository,
            HubUserRoleRepository userRoleRepository,
            JdbcTemplate jdbcTemplate) {
        this.hospitalRepository = hospitalRepository;
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.userRoleRepository = userRoleRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<Map<String, Object>> listHospitals() {
        return hospitalRepository.findAllByOrderByNameAsc().stream()
                .map(this::toHospitalSummary)
                .toList();
    }

    public Map<String, Object> getHospital(UUID hospitalId) {
        HubHospitalEntity hospital = hospitalRepository.findById(hospitalId)
                .orElseThrow(() -> new AuthService.AuthException("Hospital not found"));
        Map<String, Object> detail = toHospitalSummary(hospital);
        detail.put("centers", listCentersForHospital(hospitalId));
        detail.put("admins", listHospitalAdmins(hospitalId));
        detail.put("roleCounts", roleCountsForHospital(hospitalId));
        detail.put("userCount", countClinicalUsers(hospitalId));
        detail.put("centerCount", listCentersForHospital(hospitalId).size());
        return detail;
    }

    public Map<String, Object> getPlatformOverview() {
        Map<String, Object> overview = new LinkedHashMap<>();

        Integer hospitals = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM hub_hospitals", Integer.class);
        Integer activeHospitals = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM hub_hospitals WHERE status = 'ACTIVE'", Integer.class);
        Integer centers = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM hub_centers WHERE hospital_id IS NOT NULL", Integer.class);
        Integer hospitalAdmins = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM hub_users
                WHERE UPPER(role) = 'HOSPITAL_ADMIN' AND active = TRUE
                """,
                Integer.class);
        Integer clinicalStaff = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM hub_users
                WHERE hospital_id IS NOT NULL
                  AND UPPER(role) NOT IN ('HOSPITAL_ADMIN', 'SUPER_ADMIN')
                  AND active = TRUE
                """,
                Integer.class);

        Map<String, Object> totals = new LinkedHashMap<>();
        totals.put("hospitals", hospitals != null ? hospitals : 0);
        totals.put("activeHospitals", activeHospitals != null ? activeHospitals : 0);
        totals.put("centers", centers != null ? centers : 0);
        totals.put("hospitalAdmins", hospitalAdmins != null ? hospitalAdmins : 0);
        totals.put("clinicalStaff", clinicalStaff != null ? clinicalStaff : 0);
        overview.put("totals", totals);
        overview.put("roleCounts", roleCountsPlatformWide());

        List<Map<String, Object>> rows = new ArrayList<>();
        int sno = 1;
        for (HubHospitalEntity hospital : hospitalRepository.findAllByOrderByNameAsc()) {
            UUID id = hospital.getId();
            List<Map<String, Object>> admins = listHospitalAdmins(id);
            Map<String, Object> row = toHospitalSummary(hospital);
            row.put("sno", sno++);
            row.put("centerCount", listCentersForHospital(id).size());
            row.put("userCount", countClinicalUsers(id));
            row.put("roleCounts", roleCountsForHospital(id));
            if (!admins.isEmpty()) {
                row.put("primaryAdmin", admins.get(0).get("displayName"));
                row.put("primaryAdminEmail", admins.get(0).get("email"));
            } else {
                row.put("primaryAdmin", null);
                row.put("primaryAdminEmail", null);
            }
            row.put("adminCount", admins.size());
            rows.add(row);
        }
        overview.put("hospitals", rows);
        return overview;
    }

    @Transactional
    public Map<String, Object> createHospital(Map<String, String> body) {
        String name = trim(body.get("name"));
        if (name == null) {
            throw new AuthService.AuthException("Hospital name is required");
        }
        String code = trim(body.get("code"));
        if (code == null) {
            code = deriveCodeFromName(name);
        }
        code = code.toUpperCase(Locale.ROOT);
        if (hospitalRepository.existsByCodeIgnoreCase(code)) {
            throw new AuthService.AuthException("Hospital code already exists: " + code);
        }

        String adminEmail = trim(body.get("adminEmail"));
        if (adminEmail == null) {
            throw new AuthService.AuthException("Hospital admin email is required");
        }

        HubHospitalEntity hospital = new HubHospitalEntity();
        hospital.setName(name);
        hospital.setCode(code);
        hospital.setStatus("ACTIVE");
        hospitalRepository.save(hospital);

        seedDefaultRoles(hospital.getId());

        String adminName = trim(body.get("adminDisplayName"));
        String adminPassword = body.get("adminPassword");
        if (adminPassword == null || adminPassword.isBlank()) {
            adminPassword = generateTempPassword();
        }

        HubAuthUserEntity admin = createHospitalAdmin(hospital.getId(), adminEmail, adminName, adminPassword);
        linkConnectEngineCenter(hospital.getId());

        Map<String, Object> result = toHospitalSummary(hospital);
        result.put("status", "created");
        result.put("adminUser", toUserSummary(admin));
        result.put("tempPassword", adminPassword);
        result.put("linkedCenterId", HubCenterIds.CONNECT_ENGINE);
        return result;
    }

    private String deriveCodeFromName(String name) {
        String slug = name.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]+", "_").replaceAll("^_|_$", "");
        if (slug.isBlank()) slug = "HOSP";
        if (slug.length() > 32) slug = slug.substring(0, 32);
        return slug;
    }

    private String generateTempPassword() {
        return "Welcome@" + UUID.randomUUID().toString().substring(0, 8);
    }

    @Transactional
    public Map<String, Object> linkCenterToHospital(UUID hospitalId, Map<String, String> body) {
        hospitalRepository.findById(hospitalId)
                .orElseThrow(() -> new AuthService.AuthException("Hospital not found"));
        String centerId = trim(body.get("centerId"));
        if (centerId == null) {
            throw new AuthService.AuthException("centerId is required");
        }
        linkCenter(hospitalId, centerId, trim(body.get("centerName")), trim(body.get("centerLocation")));
        return Map.of("ok", true, "hospitalId", hospitalId.toString(), "centerId", centerId.toUpperCase(Locale.ROOT));
    }

    public Map<String, Object> listCentersAndAdmins() {
        List<Map<String, Object>> centers = jdbcTemplate.query(
                """
                SELECT h.id AS hospital_id, h.name AS hospital_name, h.code AS hospital_code,
                       h.status AS hospital_status,
                       c.id AS center_id, c.name AS center_name, c.location,
                       COALESCE(c.status, 'ACTIVE') AS center_status
                FROM hub_centers c
                LEFT JOIN hub_hospitals h ON c.hospital_id = h.id
                ORDER BY COALESCE(h.name, ''), c.name
                """,
                (rs, rowNum) -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("hospitalId", rs.getString("hospital_id"));
                    row.put("hospitalName", rs.getString("hospital_name"));
                    row.put("hospitalCode", rs.getString("hospital_code"));
                    row.put("hospitalStatus", rs.getString("hospital_status"));
                    row.put("centerId", rs.getString("center_id"));
                    row.put("name", rs.getString("center_name"));
                    row.put("location", rs.getString("location"));
                    row.put("status", rs.getString("center_status"));
                    return row;
                });

        List<Map<String, Object>> admins = new ArrayList<>();
        for (HubHospitalEntity hospital : hospitalRepository.findAllByOrderByNameAsc()) {
            for (Map<String, Object> admin : listHospitalAdmins(hospital.getId())) {
                Map<String, Object> row = new LinkedHashMap<>(admin);
                row.put("hospitalId", hospital.getId().toString());
                row.put("hospitalName", hospital.getName());
                row.put("hospitalCode", hospital.getCode());
                row.put("hospitalStatus", hospital.getStatus());
                admins.add(row);
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("centers", centers);
        result.put("admins", admins);
        return result;
    }

    @Transactional
    public Map<String, Object> updateHospitalStatus(UUID hospitalId, Map<String, String> body) {
        HubHospitalEntity hospital = requireHospital(hospitalId);
        String status = normalizeStatus(body.get("status"));
        hospital.setStatus(status);
        hospitalRepository.save(hospital);
        if ("INACTIVE".equals(status)) {
            deactivateHospitalUsers(hospitalId);
        }
        return toHospitalSummary(hospital);
    }

    @Transactional
    public void deleteHospital(UUID hospitalId) {
        HubHospitalEntity hospital = requireHospital(hospitalId);
        deactivateHospitalUsers(hospitalId);
        jdbcTemplate.update(
                "UPDATE hub_centers SET status = 'INACTIVE', hospital_id = NULL WHERE hospital_id = ?",
                hospitalId);
        hospital.setStatus("INACTIVE");
        hospitalRepository.save(hospital);
    }

    @Transactional
    public Map<String, Object> updateCenterStatus(UUID hospitalId, String centerId, Map<String, String> body) {
        requireHospital(hospitalId);
        String id = centerId.toUpperCase(Locale.ROOT);
        assertCenterLinkedToHospital(hospitalId, id);
        String status = normalizeStatus(body.get("status"));
        jdbcTemplate.update("UPDATE hub_centers SET status = ? WHERE id = ?", status, id);
        return centerRow(hospitalId, id);
    }

    @Transactional
    public void deleteCenter(UUID hospitalId, String centerId) {
        requireHospital(hospitalId);
        String id = centerId.toUpperCase(Locale.ROOT);
        assertCenterLinkedToHospital(hospitalId, id);
        Integer units = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM hub_units WHERE center_id = ?", Integer.class, id);
        if (units != null && units > 0) {
            jdbcTemplate.update(
                    "UPDATE hub_centers SET status = 'INACTIVE', hospital_id = NULL WHERE id = ?", id);
        } else {
            jdbcTemplate.update("DELETE FROM hub_centers WHERE id = ?", id);
        }
    }

    @Transactional
    public Map<String, Object> updateHospitalAdmin(UUID hospitalId, UUID userId, Map<String, String> body) {
        HubAuthUserEntity admin = requireHospitalAdmin(hospitalId, userId);
        if (body.containsKey("active")) {
            admin.setActive(Boolean.parseBoolean(body.get("active")));
        }
        userRepository.save(admin);
        return toUserSummary(admin);
    }

    @Transactional
    public void deleteHospitalAdmin(UUID hospitalId, UUID userId) {
        HubAuthUserEntity admin = requireHospitalAdmin(hospitalId, userId);
        userRoleRepository.deleteByUserId(userId);
        userRepository.delete(admin);
    }

    @Transactional
    public Map<String, Object> createHospitalAdminUser(UUID hospitalId, Map<String, String> body) {
        requireHospital(hospitalId);
        String email = trim(body.get("email"));
        String displayName = trim(body.get("displayName"));
        String password = body.get("password");
        if (password == null || password.isBlank()) {
            password = body.get("adminPassword");
        }
        if (email == null) {
            throw new AuthService.AuthException("Email is required");
        }
        if (password == null || password.isBlank()) {
            password = generateTempPassword();
        }
        HubAuthUserEntity admin = createHospitalAdmin(hospitalId, email, displayName, password);
        Map<String, Object> result = toUserSummary(admin);
        result.put("tempPassword", password);
        return result;
    }

    @Transactional
    public Map<String, Object> resetHospitalAdminTempPassword(UUID hospitalId, UUID userId, Map<String, String> body) {
        HubAuthUserEntity admin = requireHospitalAdmin(hospitalId, userId);
        String password = body != null ? body.get("password") : null;
        if (password == null || password.isBlank()) {
            password = body != null ? body.get("adminPassword") : null;
        }
        if (password == null || password.isBlank()) {
            password = generateTempPassword();
        }
        admin.setPasswordHash(passwordEncoder.encode(password));
        admin.setMustChangePassword(true);
        userRepository.save(admin);
        Map<String, Object> result = toUserSummary(admin);
        result.put("tempPassword", password);
        return result;
    }

    private void linkConnectEngineCenter(UUID hospitalId) {
        linkCenter(
                hospitalId,
                HubCenterIds.CONNECT_ENGINE,
                HubCenterIds.CONNECT_ENGINE,
                HubCenterIds.CONNECT_ENGINE_LOCATION);
    }

    private void linkCenter(UUID hospitalId, String centerId, String name, String location) {
        String id = centerId.toUpperCase(Locale.ROOT);
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM hub_centers WHERE id = ?", Integer.class, id);
        if (count != null && count > 0) {
            jdbcTemplate.update(
                    "UPDATE hub_centers SET hospital_id = ?, status = 'ACTIVE' WHERE id = ?", hospitalId, id);
        } else {
            jdbcTemplate.update(
                    "INSERT INTO hub_centers (id, name, location, hospital_id, status) VALUES (?, ?, ?, ?, 'ACTIVE')",
                    id,
                    name != null ? name : id,
                    location,
                    hospitalId);
        }
    }

    private HubHospitalEntity requireHospital(UUID hospitalId) {
        return hospitalRepository.findById(hospitalId)
                .orElseThrow(() -> new AuthService.AuthException("Hospital not found"));
    }

    private void assertCenterLinkedToHospital(UUID hospitalId, String centerId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM hub_centers WHERE id = ? AND hospital_id = ?",
                Integer.class, centerId, hospitalId);
        if (count == null || count == 0) {
            throw new AuthService.AuthException("Center not linked to this hospital");
        }
    }

    private Map<String, Object> centerRow(UUID hospitalId, String centerId) {
        HubHospitalEntity hospital = requireHospital(hospitalId);
        return jdbcTemplate.queryForObject(
                """
                SELECT c.id AS center_id, c.name AS center_name, c.location, c.status AS center_status
                FROM hub_centers c WHERE c.id = ? AND c.hospital_id = ?
                """,
                (rs, rowNum) -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("hospitalId", hospital.getId().toString());
                    row.put("hospitalName", hospital.getName());
                    row.put("hospitalCode", hospital.getCode());
                    row.put("hospitalStatus", hospital.getStatus());
                    row.put("centerId", rs.getString("center_id"));
                    row.put("name", rs.getString("center_name"));
                    row.put("location", rs.getString("location"));
                    row.put("status", rs.getString("center_status"));
                    return row;
                },
                centerId, hospitalId);
    }

    private HubAuthUserEntity requireHospitalAdmin(UUID hospitalId, UUID userId) {
        HubAuthUserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new AuthService.AuthException("User not found"));
        if (!hospitalId.equals(user.getHospitalId())) {
            throw new AuthService.AuthException("Admin not in this hospital");
        }
        if (!"HOSPITAL_ADMIN".equalsIgnoreCase(user.getRole())) {
            throw new AuthService.AuthException("User is not a hospital admin");
        }
        return user;
    }

    private void deactivateHospitalUsers(UUID hospitalId) {
        userRepository.findByHospitalIdOrderByDisplayNameAsc(hospitalId).forEach(user -> {
            user.setActive(false);
            userRepository.save(user);
        });
    }

    private static String normalizeStatus(String status) {
        if (status == null) {
            throw new AuthService.AuthException("status is required");
        }
        String normalized = status.trim().toUpperCase(Locale.ROOT);
        if (!"ACTIVE".equals(normalized) && !"INACTIVE".equals(normalized)) {
            throw new AuthService.AuthException("status must be ACTIVE or INACTIVE");
        }
        return normalized;
    }

    private HubAuthUserEntity createHospitalAdmin(UUID hospitalId, String email, String displayName, String password) {
        email = email.toLowerCase(Locale.ROOT);
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new AuthService.AuthException("Email already registered: " + email);
        }
        HubAuthUserEntity user = new HubAuthUserEntity();
        user.setEmail(email);
        user.setUsername(email.split("@")[0]);
        user.setDisplayName(displayName != null ? displayName : email);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setUserType("HOSPITAL_USER");
        user.setRole("HOSPITAL_ADMIN");
        user.setHospitalId(hospitalId);
        user.setActive(true);
        user.setTotpEnabled(false);
        user.setMustChangePassword(true);
        return userRepository.save(user);
    }

    private void seedDefaultRoles(UUID hospitalId) {
        createSystemRole(hospitalId, "Intensivist", "Senior ICU physician", PermissionCatalog.CLINICAL);
        createSystemRole(hospitalId, "CCN", "Critical care nurse", PermissionCatalog.NURSING);
        createSystemRole(hospitalId, "RMO", "Resident medical officer", PermissionCatalog.CLINICAL);
        createSystemRole(hospitalId, "Respiratory Therapist", "Ventilator & airway care", PermissionCatalog.RT);
    }

    private void createSystemRole(UUID hospitalId, String name, String description, List<String> permissions) {
        if (roleRepository.existsByHospitalIdAndNameIgnoreCase(hospitalId, name)) return;
        HubRoleEntity role = new HubRoleEntity();
        role.setHospitalId(hospitalId);
        role.setName(name);
        role.setDescription(description);
        role.setSystemRole(true);
        role.setPermissions(new ArrayList<>(permissions));
        roleRepository.save(role);
    }

    private List<Map<String, Object>> listCentersForHospital(UUID hospitalId) {
        return jdbcTemplate.query(
                "SELECT id, name, location, COALESCE(status, 'ACTIVE') AS status FROM hub_centers WHERE hospital_id = ? ORDER BY name",
                (rs, rowNum) -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("centerId", rs.getString("id"));
                    row.put("name", rs.getString("name"));
                    row.put("location", rs.getString("location"));
                    row.put("status", rs.getString("status"));
                    return row;
                },
                hospitalId);
    }

    private List<Map<String, Object>> listHospitalAdmins(UUID hospitalId) {
        return userRepository.findByHospitalIdOrderByDisplayNameAsc(hospitalId).stream()
                .filter(u -> "HOSPITAL_ADMIN".equalsIgnoreCase(u.getRole()))
                .map(this::toUserSummary)
                .toList();
    }

    private Map<String, Object> toHospitalSummary(HubHospitalEntity hospital) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", hospital.getId().toString());
        map.put("name", hospital.getName());
        map.put("code", hospital.getCode());
        map.put("status", hospital.getStatus());
        return map;
    }

    private Map<String, Object> toUserSummary(HubAuthUserEntity user) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", user.getId().toString());
        map.put("email", user.getEmail());
        map.put("displayName", user.getDisplayName());
        map.put("role", user.getRole());
        map.put("active", user.isActive());
        return map;
    }

    private static String trim(String value) {
        if (value == null) return null;
        String t = value.trim();
        return t.isEmpty() ? null : t;
    }

    private int countClinicalUsers(UUID hospitalId) {
        Integer count = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM hub_users
                WHERE hospital_id = ?
                  AND UPPER(role) NOT IN ('HOSPITAL_ADMIN', 'SUPER_ADMIN')
                  AND active = TRUE
                """,
                Integer.class,
                hospitalId);
        return count != null ? count : 0;
    }

    private List<Map<String, Object>> roleCountsPlatformWide() {
        return jdbcTemplate.query(
                """
                SELECT COALESCE(NULLIF(TRIM(role), ''), 'Unassigned') AS role_name, COUNT(*) AS cnt
                FROM hub_users
                WHERE hospital_id IS NOT NULL
                  AND UPPER(role) NOT IN ('HOSPITAL_ADMIN', 'SUPER_ADMIN')
                  AND active = TRUE
                GROUP BY role
                ORDER BY cnt DESC, role_name
                """,
                (rs, rowNum) -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("role", rs.getString("role_name"));
                    row.put("count", rs.getInt("cnt"));
                    return row;
                });
    }

    private Map<String, Integer> roleCountsForHospital(UUID hospitalId) {
        List<Map<String, Object>> rows = jdbcTemplate.query(
                """
                SELECT COALESCE(NULLIF(TRIM(role), ''), 'Unassigned') AS role_name, COUNT(*) AS cnt
                FROM hub_users
                WHERE hospital_id = ?
                  AND UPPER(role) NOT IN ('HOSPITAL_ADMIN', 'SUPER_ADMIN')
                  AND active = TRUE
                GROUP BY role
                ORDER BY cnt DESC, role_name
                """,
                (rs, rowNum) -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("role", rs.getString("role_name"));
                    row.put("count", rs.getInt("cnt"));
                    return row;
                },
                hospitalId);
        Map<String, Integer> map = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            map.put(String.valueOf(row.get("role")), (Integer) row.get("count"));
        }
        return map;
    }
}
