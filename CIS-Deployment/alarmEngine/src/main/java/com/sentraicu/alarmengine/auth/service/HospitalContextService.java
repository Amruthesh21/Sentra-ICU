package com.sentraicu.alarmengine.auth.service;

import com.sentraicu.alarmengine.auth.security.AuthPrincipal;
import com.sentraicu.alarmengine.auth.security.JwtAuthFilter;
import com.sentraicu.alarmengine.hub.entity.HubBedAssignmentEntity;
import com.sentraicu.alarmengine.hub.entity.HubBedEntity;
import com.sentraicu.alarmengine.hub.repo.HubBedAssignmentRepository;
import com.sentraicu.alarmengine.hub.repo.HubBedRepository;
import com.sentraicu.alarmengine.service.BedIdUtil;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * Resolves the ICU center for the signed-in hospital. Super Admin has no ward;
 * hospital users only see the center linked to their hospital.
 */
@Service
public class HospitalContextService {

    private final JdbcTemplate jdbcTemplate;
    private final HubBedRepository bedRepository;
    private final HubBedAssignmentRepository assignmentRepository;

    public HospitalContextService(
            JdbcTemplate jdbcTemplate,
            HubBedRepository bedRepository,
            HubBedAssignmentRepository assignmentRepository) {
        this.jdbcTemplate = jdbcTemplate;
        this.bedRepository = bedRepository;
        this.assignmentRepository = assignmentRepository;
    }

    public String resolveCenterId(HttpServletRequest request) {
        AuthPrincipal principal = principal(request);
        if (principal.isSuperAdmin()) {
            throw new AuthService.AuthException("Hospital context required", 403);
        }
        UUID hospitalId = principal.getHospitalId();
        if (hospitalId == null) {
            throw new AuthService.AuthException("Hospital not assigned", 403);
        }
        return centerIdForHospital(hospitalId);
    }

    public UUID resolveHospitalId(HttpServletRequest request) {
        AuthPrincipal principal = principal(request);
        if (principal.isSuperAdmin()) {
            throw new AuthService.AuthException("Hospital context required", 403);
        }
        if (principal.getHospitalId() == null) {
            throw new AuthService.AuthException("Hospital not assigned", 403);
        }
        return principal.getHospitalId();
    }

    public String centerIdForHospital(UUID hospitalId) {
        List<String> ids = jdbcTemplate.query(
                """
                SELECT id FROM hub_centers
                WHERE hospital_id = ?
                  AND COALESCE(status, 'ACTIVE') = 'ACTIVE'
                ORDER BY id
                """,
                (rs, rowNum) -> rs.getString("id"),
                hospitalId);
        if (ids.isEmpty()) {
            throw new AuthService.AuthException("No ICU is configured for this hospital", 403);
        }
        return ids.get(0);
    }

    public void assertBedInCenter(HttpServletRequest request, String bedId) {
        String centerId = resolveCenterId(request);
        if (!bedInCenter(centerId, bedId)) {
            throw new AuthService.AuthException("Bed is not in this hospital", 403);
        }
    }

    public void assertVisitInCenter(HttpServletRequest request, UUID visitId) {
        String centerId = resolveCenterId(request);
        HubBedAssignmentEntity assignment = assignmentRepository.findFirstByVisitIdOrderByAssignedAtDesc(visitId)
                .orElseThrow(() -> new AuthService.AuthException("Visit not found", 403));
        HubBedEntity bed = bedRepository.findById(assignment.getBedId())
                .orElseThrow(() -> new AuthService.AuthException("Bed not found", 403));
        if (bed.getCenterId() == null || !centerId.equalsIgnoreCase(bed.getCenterId())) {
            throw new AuthService.AuthException("Visit is not in this hospital", 403);
        }
    }

    public boolean bedInCenter(String centerId, String bedId) {
        if (centerId == null || bedId == null || bedId.isBlank()) return false;
        Set<String> wanted = new HashSet<>();
        for (String id : BedIdUtil.allLookupIds(bedId)) {
            wanted.add(id.toUpperCase(Locale.ROOT));
        }
        for (HubBedEntity bed : bedRepository.findByCenterIdAndActiveTrueOrderByBedLabel(centerId)) {
            if (bed.getBedLabel() == null) continue;
            for (String id : BedIdUtil.allLookupIds(bed.getBedLabel())) {
                if (wanted.contains(id.toUpperCase(Locale.ROOT))) return true;
            }
        }
        return false;
    }

    private AuthPrincipal principal(HttpServletRequest request) {
        AuthPrincipal principal = (AuthPrincipal) request.getAttribute(JwtAuthFilter.AUTH_ATTR);
        if (principal == null) {
            throw new AuthService.AuthException("Authentication required");
        }
        return principal;
    }
}
