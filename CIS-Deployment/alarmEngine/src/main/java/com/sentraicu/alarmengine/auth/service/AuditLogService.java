package com.sentraicu.alarmengine.auth.service;

import com.sentraicu.alarmengine.auth.entity.HubAuthUserEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;

@Service
public class AuditLogService {

    private static final String AUDIT_SELECT = """
            SELECT a.id, a.action, a.category,
                   COALESCE(NULLIF(TRIM(a.detail), ''), a.action) AS detail,
                   a.ip_address, a.created_at, a.hospital_id,
                   COALESCE(NULLIF(TRIM(a.actor_email), ''), u.email) AS actor_email,
                   COALESCE(NULLIF(TRIM(a.actor_name), ''), u.display_name) AS actor_name,
                   COALESCE(h.name, h2.name) AS hospital_name
            FROM hub_auth_audit a
            LEFT JOIN hub_users u ON a.user_id = u.id
            LEFT JOIN hub_hospitals h ON a.hospital_id = h.id
            LEFT JOIN hub_hospitals h2 ON u.hospital_id = h2.id
            """;

    private final JdbcTemplate jdbcTemplate;

    public AuditLogService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void record(HubAuthUserEntity actor, UUID hospitalId, String category, String action, String detail, String ipAddress) {
        UUID actorId = actor != null ? actor.getId() : null;
        String email = actor != null ? actor.getEmail() : null;
        String name = actor != null ? actor.getDisplayName() : null;
        jdbcTemplate.update(
                """
                INSERT INTO hub_auth_audit
                    (id, user_id, hospital_id, category, action, detail, ip_address, actor_email, actor_name, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                UUID.randomUUID(),
                actorId,
                hospitalId,
                category != null ? category : "SYSTEM",
                action,
                detail,
                ipAddress,
                email,
                name,
                Timestamp.from(Instant.now()));
    }

    public void recordAuth(HubAuthUserEntity user, String action, String detail, String ipAddress) {
        if (user == null) {
            return;
        }
        jdbcTemplate.update(
                """
                INSERT INTO hub_auth_audit
                    (id, user_id, hospital_id, category, action, detail, ip_address, actor_email, actor_name, created_at)
                VALUES (?, ?, ?, 'AUTH', ?, ?, ?, ?, ?, ?)
                """,
                UUID.randomUUID(),
                user.getId(),
                user.getHospitalId(),
                action,
                detail != null ? detail : action,
                ipAddress,
                user.getEmail(),
                user.getDisplayName(),
                Timestamp.from(Instant.now()));
    }

    public List<Map<String, Object>> listForSuperAdmin(UUID hospitalId, String category, int limit) {
        StringBuilder sql = new StringBuilder(AUDIT_SELECT).append(" WHERE 1=1");
        List<Object> params = new ArrayList<>();
        if (hospitalId != null) {
            sql.append(" AND (a.hospital_id = ? OR u.hospital_id = ?)");
            params.add(hospitalId);
            params.add(hospitalId);
        }
        appendCategoryFilter(sql, params, category);
        sql.append(" ORDER BY a.created_at DESC LIMIT ?");
        params.add(clampLimit(limit));
        return jdbcTemplate.query(sql.toString(), this::mapRow, params.toArray());
    }

    public List<Map<String, Object>> listForHospital(UUID hospitalId, String category, int limit) {
        StringBuilder sql = new StringBuilder(AUDIT_SELECT)
                .append(" WHERE (a.hospital_id = ? OR u.hospital_id = ?)");
        List<Object> params = new ArrayList<>();
        params.add(hospitalId);
        params.add(hospitalId);
        appendCategoryFilter(sql, params, category);
        sql.append(" ORDER BY a.created_at DESC LIMIT ?");
        params.add(clampLimit(limit));
        return jdbcTemplate.query(sql.toString(), this::mapRow, params.toArray());
    }

    public Map<String, Object> platformAnalytics() {
        Map<String, Object> result = new LinkedHashMap<>();

        Integer totalEvents = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM hub_auth_audit WHERE created_at >= NOW() - INTERVAL '30 days'",
                Integer.class);
        Integer loginSuccess = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM hub_auth_audit WHERE action = 'LOGIN_SUCCESS' AND created_at >= NOW() - INTERVAL '30 days'",
                Integer.class);
        Integer platformActions = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM hub_auth_audit WHERE category = 'PLATFORM' AND created_at >= NOW() - INTERVAL '30 days'",
                Integer.class);
        Integer hospitalActions = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM hub_auth_audit WHERE category = 'HOSPITAL' AND created_at >= NOW() - INTERVAL '30 days'",
                Integer.class);

        result.put("totals", Map.of(
                "events30d", totalEvents != null ? totalEvents : 0,
                "logins30d", loginSuccess != null ? loginSuccess : 0,
                "platformActions30d", platformActions != null ? platformActions : 0,
                "hospitalActions30d", hospitalActions != null ? hospitalActions : 0));

        List<Map<String, Object>> eventsByDay = jdbcTemplate.query(
                """
                SELECT DATE(created_at) AS day, COUNT(*) AS count
                FROM hub_auth_audit
                WHERE created_at >= NOW() - INTERVAL '14 days'
                GROUP BY DATE(created_at)
                ORDER BY day
                """,
                (rs, rowNum) -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("day", rs.getDate("day").toString());
                    row.put("count", rs.getInt("count"));
                    return row;
                });
        result.put("eventsByDay", eventsByDay);

        List<Map<String, Object>> loginsByDay = jdbcTemplate.query(
                """
                SELECT DATE(created_at) AS day, COUNT(*) AS count
                FROM hub_auth_audit
                WHERE action = 'LOGIN_SUCCESS' AND created_at >= NOW() - INTERVAL '14 days'
                GROUP BY DATE(created_at)
                ORDER BY day
                """,
                (rs, rowNum) -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("day", rs.getDate("day").toString());
                    row.put("count", rs.getInt("count"));
                    return row;
                });
        result.put("loginsByDay", loginsByDay);

        List<Map<String, Object>> byCategory = jdbcTemplate.query(
                """
                SELECT COALESCE(category, 'UNKNOWN') AS category, COUNT(*) AS count
                FROM hub_auth_audit
                WHERE created_at >= NOW() - INTERVAL '30 days'
                GROUP BY category
                ORDER BY count DESC
                """,
                (rs, rowNum) -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("category", rs.getString("category"));
                    row.put("count", rs.getInt("count"));
                    return row;
                });
        result.put("byCategory", byCategory);

        List<Map<String, Object>> topActions = jdbcTemplate.query(
                """
                SELECT action, COUNT(*) AS count
                FROM hub_auth_audit
                WHERE created_at >= NOW() - INTERVAL '30 days'
                GROUP BY action
                ORDER BY count DESC
                LIMIT 12
                """,
                (rs, rowNum) -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("action", rs.getString("action"));
                    row.put("count", rs.getInt("count"));
                    return row;
                });
        result.put("topActions", topActions);

        List<Map<String, Object>> hospitalActivity = jdbcTemplate.query(
                """
                SELECT h.name AS hospital_name, h.id AS hospital_id, COUNT(a.id) AS event_count
                FROM hub_auth_audit a
                JOIN hub_hospitals h ON a.hospital_id = h.id
                WHERE a.created_at >= NOW() - INTERVAL '30 days'
                GROUP BY h.id, h.name
                ORDER BY event_count DESC
                LIMIT 10
                """,
                (rs, rowNum) -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("hospitalId", rs.getString("hospital_id"));
                    row.put("hospitalName", rs.getString("hospital_name"));
                    row.put("eventCount", rs.getInt("event_count"));
                    return row;
                });
        result.put("hospitalActivity", hospitalActivity);

        Integer hospitals = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM hub_hospitals", Integer.class);
        Integer activeHospitals = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM hub_hospitals WHERE status = 'ACTIVE'", Integer.class);
        Integer centers = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM hub_centers WHERE hospital_id IS NOT NULL", Integer.class);
        Integer staff = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM hub_users
                WHERE hospital_id IS NOT NULL
                  AND UPPER(role) NOT IN ('HOSPITAL_ADMIN', 'SUPER_ADMIN')
                  AND active = TRUE
                """,
                Integer.class);
        result.put("platform", Map.of(
                "hospitals", hospitals != null ? hospitals : 0,
                "activeHospitals", activeHospitals != null ? activeHospitals : 0,
                "centers", centers != null ? centers : 0,
                "clinicalStaff", staff != null ? staff : 0));

        return result;
    }

    private static void appendCategoryFilter(StringBuilder sql, List<Object> params, String category) {
        if (category != null && !category.isBlank() && !"ALL".equalsIgnoreCase(category)) {
            sql.append(" AND a.category = ?");
            params.add(category.toUpperCase(Locale.ROOT));
        }
    }

    private static int clampLimit(int limit) {
        return Math.min(Math.max(limit, 1), 500);
    }

    private Map<String, Object> mapRow(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", rs.getString("id"));
        row.put("action", rs.getString("action"));
        row.put("category", rs.getString("category"));
        row.put("detail", rs.getString("detail"));
        row.put("ipAddress", rs.getString("ip_address"));
        Timestamp ts = rs.getTimestamp("created_at");
        row.put("createdAt", ts != null ? ts.toInstant().toString() : null);
        row.put("actorEmail", rs.getString("actor_email"));
        row.put("actorName", rs.getString("actor_name"));
        row.put("hospitalId", rs.getString("hospital_id"));
        row.put("hospitalName", rs.getString("hospital_name"));
        return row;
    }
}
