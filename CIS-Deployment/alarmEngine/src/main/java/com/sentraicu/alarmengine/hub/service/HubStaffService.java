package com.sentraicu.alarmengine.hub.service;

import com.sentraicu.alarmengine.hub.entity.*;
import com.sentraicu.alarmengine.hub.repo.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class HubStaffService {

    public static final List<String> DOCTOR_ROLES = List.of("INTENSIVIST", "PHYSICIAN", "CONSULTANT");
    public static final List<String> NURSE_ROLES = List.of("ICU_NURSE", "CHARGE_NURSE", "CCN", "NURSE");

    private final HubStaffRepository staffRepository;
    private final HubBedAssignmentRepository assignmentRepository;
    private final HubPatientVisitRepository visitRepository;
    private final HubBedRepository bedRepository;
    private final HubPatientRepository patientRepository;

    public HubStaffService(HubStaffRepository staffRepository,
                           HubBedAssignmentRepository assignmentRepository,
                           HubPatientVisitRepository visitRepository,
                           HubBedRepository bedRepository,
                           HubPatientRepository patientRepository) {
        this.staffRepository = staffRepository;
        this.assignmentRepository = assignmentRepository;
        this.visitRepository = visitRepository;
        this.bedRepository = bedRepository;
        this.patientRepository = patientRepository;
    }

    public List<Map<String, Object>> list(String centerId, String roleFilter) {
        String cid = normalize(centerId);
        List<HubStaffEntity> rows;
        if ("doctor".equalsIgnoreCase(roleFilter)) {
            rows = staffRepository.findByCenterIdAndActiveTrueAndRoleCodeInOrderByFullNameAsc(cid, DOCTOR_ROLES);
        } else if ("nurse".equalsIgnoreCase(roleFilter)) {
            rows = staffRepository.findByCenterIdAndActiveTrueAndRoleCodeInOrderByFullNameAsc(cid, NURSE_ROLES);
        } else {
            rows = staffRepository.findByCenterIdAndActiveTrueOrderByFullNameAsc(cid);
        }

        Map<String, List<LiveAssignment>> byStaffName = buildLiveAssignments(cid);
        return rows.stream().map(e -> toMap(e, byStaffName)).toList();
    }

    @Transactional
    public Map<String, Object> create(Map<String, Object> request, String centerId) {
        HubStaffEntity e = new HubStaffEntity();
        e.setCenterId(normalize(centerId));
        apply(e, request);
        if (e.getFullName() == null || e.getFullName().isBlank()) {
            throw new IllegalArgumentException("fullName is required");
        }
        if (e.getRoleCode() == null || e.getRoleCode().isBlank()) {
            throw new IllegalArgumentException("roleCode is required");
        }
        HubStaffEntity saved = staffRepository.save(e);
        Map<String, List<LiveAssignment>> live = buildLiveAssignments(saved.getCenterId());
        return toMap(saved, live);
    }

    @Transactional
    public Map<String, Object> update(UUID id, Map<String, Object> request) {
        HubStaffEntity e = staffRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Staff not found"));
        apply(e, request);
        HubStaffEntity saved = staffRepository.save(e);
        Map<String, List<LiveAssignment>> live = buildLiveAssignments(saved.getCenterId());
        return toMap(saved, live);
    }

    @Transactional
    public Map<String, Object> deactivate(UUID id) {
        HubStaffEntity e = staffRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Staff not found"));
        e.setActive(false);
        e.setStatus("OFF");
        HubStaffEntity saved = staffRepository.save(e);
        Map<String, List<LiveAssignment>> live = buildLiveAssignments(saved.getCenterId());
        return toMap(saved, live);
    }

    /**
     * Active admissions → doctor/nurse name → beds + patients.
     * Source of truth is visit.attendingPhysician / visit.primaryNurse from Admit form.
     */
    private Map<String, List<LiveAssignment>> buildLiveAssignments(String centerId) {
        Map<String, List<LiveAssignment>> byName = new HashMap<>();
        List<HubBedAssignmentEntity> active = assignmentRepository.findByActiveTrue();
        if (active.isEmpty()) {
            return byName;
        }

        Map<UUID, HubBedEntity> beds = bedRepository.findAllById(
                active.stream().map(HubBedAssignmentEntity::getBedId).collect(Collectors.toSet())
        ).stream().collect(Collectors.toMap(HubBedEntity::getId, b -> b, (a, b) -> a));

        Map<UUID, HubPatientVisitEntity> visits = visitRepository.findAllById(
                active.stream().map(HubBedAssignmentEntity::getVisitId).collect(Collectors.toSet())
        ).stream().collect(Collectors.toMap(HubPatientVisitEntity::getId, v -> v, (a, b) -> a));

        Set<UUID> patientIds = visits.values().stream()
                .map(HubPatientVisitEntity::getPatientId)
                .collect(Collectors.toSet());
        Map<UUID, HubPatientEntity> patients = patientRepository.findAllById(patientIds).stream()
                .collect(Collectors.toMap(HubPatientEntity::getId, p -> p, (a, b) -> a));

        for (HubBedAssignmentEntity a : active) {
            HubBedEntity bed = beds.get(a.getBedId());
            HubPatientVisitEntity visit = visits.get(a.getVisitId());
            if (bed == null || visit == null) continue;
            if (centerId != null && bed.getCenterId() != null
                    && !centerId.equalsIgnoreCase(bed.getCenterId())) {
                continue;
            }
            if (!"ACTIVE".equalsIgnoreCase(visit.getStatus())) continue;

            HubPatientEntity patient = patients.get(visit.getPatientId());
            String patientName = patient != null ? patient.getFullName() : null;
            String bedLabel = bed.getBedLabel();

            addAssignment(byName, visit.getAttendingPhysician(), bedLabel, patientName, "doctor");
            addAssignment(byName, visit.getPrimaryNurse(), bedLabel, patientName, "nurse");
        }
        return byName;
    }

    private void addAssignment(Map<String, List<LiveAssignment>> byName,
                               String staffName,
                               String bedLabel,
                               String patientName,
                               String role) {
        if (staffName == null || staffName.isBlank() || bedLabel == null || bedLabel.isBlank()) {
            return;
        }
        String key = normalizePerson(staffName);
        byName.computeIfAbsent(key, k -> new ArrayList<>())
                .add(new LiveAssignment(bedLabel, patientName, role));
    }

    private void apply(HubStaffEntity e, Map<String, Object> request) {
        if (request.containsKey("fullName")) e.setFullName(str(request.get("fullName")));
        if (request.containsKey("name")) e.setFullName(str(request.get("name")));
        if (request.containsKey("roleCode")) e.setRoleCode(normalizeRole(str(request.get("roleCode"))));
        if (request.containsKey("role")) e.setRoleCode(normalizeRole(str(request.get("role"))));
        if (request.containsKey("specialty")) e.setSpecialty(str(request.get("specialty")));
        if (request.containsKey("status")) e.setStatus(normalizeStatus(str(request.get("status"))));
        if (request.containsKey("assignedBeds")) e.setAssignedBeds(str(request.get("assignedBeds")));
        if (request.containsKey("beds")) e.setAssignedBeds(str(request.get("beds")));
        if (request.containsKey("phone")) e.setPhone(str(request.get("phone")));
        if (request.containsKey("email")) e.setEmail(str(request.get("email")));
        if (request.containsKey("active") && request.get("active") != null) {
            e.setActive(Boolean.parseBoolean(String.valueOf(request.get("active"))));
        }
    }

    private Map<String, Object> toMap(HubStaffEntity e, Map<String, List<LiveAssignment>> byStaffName) {
        List<LiveAssignment> live = matchAssignments(e.getFullName(), byStaffName);
        LinkedHashSet<String> bedLabels = new LinkedHashSet<>();
        LinkedHashSet<String> patientNames = new LinkedHashSet<>();
        List<Map<String, Object>> assignmentMaps = new ArrayList<>();

        for (LiveAssignment la : live) {
            if (la.bedLabel != null && !la.bedLabel.isBlank()) bedLabels.add(la.bedLabel);
            if (la.patientName != null && !la.patientName.isBlank()) patientNames.add(la.patientName);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("bedLabel", la.bedLabel);
            row.put("patientName", la.patientName);
            row.put("role", la.role);
            assignmentMaps.add(row);
        }

        // Keep any manually entered roster beds as fallback/extra
        if (e.getAssignedBeds() != null && !e.getAssignedBeds().isBlank() && !e.getAssignedBeds().equals("—")) {
            for (String part : e.getAssignedBeds().split("[,;|]")) {
                String bed = part.trim();
                if (!bed.isEmpty() && !bed.equals("—")) bedLabels.add(bed);
            }
        }

        String bedsDisplay = bedLabels.isEmpty() ? "—" : String.join(", ", bedLabels);
        String patientsDisplay = patientNames.isEmpty() ? "—" : String.join(", ", patientNames);

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", e.getId().toString());
        m.put("centerId", e.getCenterId());
        m.put("fullName", e.getFullName());
        m.put("name", e.getFullName());
        m.put("roleCode", e.getRoleCode());
        m.put("role", e.getRoleCode());
        m.put("roleLabel", roleLabel(e.getRoleCode()));
        m.put("specialty", e.getSpecialty());
        m.put("status", e.getStatus());
        m.put("onDuty", "ON_DUTY".equalsIgnoreCase(e.getStatus()) || "ON".equalsIgnoreCase(e.getStatus()));
        m.put("assignedBeds", bedsDisplay);
        m.put("assignedPatients", patientsDisplay);
        m.put("assignments", assignmentMaps);
        m.put("phone", e.getPhone());
        m.put("email", e.getEmail());
        m.put("active", e.isActive());
        m.put("category", DOCTOR_ROLES.contains(e.getRoleCode()) ? "doctor"
                : NURSE_ROLES.contains(e.getRoleCode()) ? "nurse" : "other");
        return m;
    }

    private List<LiveAssignment> matchAssignments(String fullName,
                                                  Map<String, List<LiveAssignment>> byStaffName) {
        if (fullName == null || fullName.isBlank() || byStaffName.isEmpty()) {
            return List.of();
        }
        String key = normalizePerson(fullName);
        List<LiveAssignment> exact = byStaffName.get(key);
        if (exact != null && !exact.isEmpty()) {
            return exact;
        }
        // Fuzzy: admission saved "Dr. Bhanu" vs roster "Bhanu"
        List<LiveAssignment> fuzzy = new ArrayList<>();
        for (Map.Entry<String, List<LiveAssignment>> entry : byStaffName.entrySet()) {
            String saved = entry.getKey();
            if (saved.equals(key) || saved.contains(key) || key.contains(saved)) {
                fuzzy.addAll(entry.getValue());
            }
        }
        return fuzzy;
    }

    private static String normalizePerson(String name) {
        String n = name == null ? "" : name.trim().toLowerCase(Locale.ROOT);
        n = n.replaceAll("^(dr\\.?|mr\\.?|mrs\\.?|ms\\.?|nurse)\\s+", "");
        return n.replaceAll("\\s+", " ").trim();
    }

    private static String roleLabel(String code) {
        if (code == null) return "";
        return switch (code) {
            case "INTENSIVIST" -> "INTENSIVIST";
            case "PHYSICIAN" -> "PHYSICIAN";
            case "CONSULTANT" -> "CONSULTANT";
            case "ICU_NURSE" -> "ICU NURSE";
            case "CHARGE_NURSE" -> "CHARGE NURSE";
            case "CCN" -> "CRITICAL CARE NURSE";
            case "NURSE" -> "NURSE";
            case "RESPIRATORY" -> "RESPIRATORY";
            default -> code.replace('_', ' ');
        };
    }

    private static String normalizeRole(String role) {
        if (role == null) return null;
        String r = role.trim().toUpperCase(Locale.ROOT).replace(' ', '_');
        if ("ICU NURSE".equalsIgnoreCase(role.trim())) return "ICU_NURSE";
        if ("CHARGE NURSE".equalsIgnoreCase(role.trim())) return "CHARGE_NURSE";
        return r;
    }

    private static String normalizeStatus(String status) {
        if (status == null || status.isBlank()) return "ON_DUTY";
        String s = status.trim().toUpperCase(Locale.ROOT);
        if (s.equals("ON") || s.equals("ON DUTY") || s.equals("ON_DUTY")) return "ON_DUTY";
        if (s.equals("OFF") || s.equals("OFF_DUTY")) return "OFF";
        return s;
    }

    private static String normalize(String centerId) {
        return centerId == null || centerId.isBlank() ? "RTWO" : centerId.trim();
    }

    private static String str(Object v) {
        return v == null ? null : String.valueOf(v).trim();
    }

    private record LiveAssignment(String bedLabel, String patientName, String role) {}
}
