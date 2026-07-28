package com.rtwo.alarmengine.hub.service;

import com.rtwo.alarmengine.hub.HubCenterIds;
import com.rtwo.alarmengine.hub.entity.*;
import com.rtwo.alarmengine.hub.repo.*;
import com.rtwo.alarmengine.service.BedDeviceService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.Period;
import java.time.ZoneId;
import java.util.*;

@Service
public class HubClinicalService {

    private static final String DEFAULT_CENTER_ID = HubCenterIds.CONNECT_ENGINE;

    private final HubBedRepository bedRepository;
    private final HubBedAssignmentRepository assignmentRepository;
    private final HubPatientVisitRepository visitRepository;
    private final HubPatientRepository patientRepository;
    private final HubUnitRepository unitRepository;
    private final HubClinicalNoteRepository noteRepository;
    private final HubOrderRepository orderRepository;
    private final HubLabResultRepository labRepository;
    private final HubImagingStudyRepository imagingRepository;
    private final BedDeviceService bedDeviceService;

    public HubClinicalService(HubBedRepository bedRepository,
                              HubBedAssignmentRepository assignmentRepository,
                              HubPatientVisitRepository visitRepository,
                              HubPatientRepository patientRepository,
                              HubUnitRepository unitRepository,
                              HubClinicalNoteRepository noteRepository,
                              HubOrderRepository orderRepository,
                              HubLabResultRepository labRepository,
                              HubImagingStudyRepository imagingRepository,
                              BedDeviceService bedDeviceService) {
        this.bedRepository = bedRepository;
        this.assignmentRepository = assignmentRepository;
        this.visitRepository = visitRepository;
        this.patientRepository = patientRepository;
        this.unitRepository = unitRepository;
        this.noteRepository = noteRepository;
        this.orderRepository = orderRepository;
        this.labRepository = labRepository;
        this.imagingRepository = imagingRepository;
        this.bedDeviceService = bedDeviceService;
    }

    public Map<String, Object> getContext(String bedId) {
        return getContext(bedId, DEFAULT_CENTER_ID);
    }

    public Map<String, Object> getContext(String bedId, String centerId) {
        String resolvedCenter = resolveCenterId(centerId);
        String bedLabel = bedDeviceService.resolveBedLabel(bedId);
        Map<String, Object> ctx = new LinkedHashMap<>();
        ctx.put("bedId", bedId);
        ctx.put("bedLabel", bedLabel);
        ctx.put("hasPatient", false);

        Optional<HubBedEntity> bed = bedRepository.findByCenterIdAndBedLabel(resolvedCenter, bedLabel);
        if (bed.isEmpty()) {
            return ctx;
        }

        Optional<HubBedAssignmentEntity> assignment =
                assignmentRepository.findByBedIdAndActiveTrue(bed.get().getId());
        if (assignment.isEmpty()) {
            return ctx;
        }

        HubPatientVisitEntity visit = visitRepository.findById(assignment.get().getVisitId())
                .orElse(null);
        if (visit == null || !"ACTIVE".equals(visit.getStatus())) {
            return ctx;
        }

        HubPatientEntity patient = patientRepository.findById(visit.getPatientId()).orElse(null);
        if (patient == null) {
            return ctx;
        }

        HubBedEntity bedEntity = bed.get();

        ctx.put("hasPatient", true);
        ctx.put("visitId", visit.getId().toString());
        ctx.put("patientId", patient.getId().toString());
        ctx.put("patientName", patient.getFullName());
        ctx.put("patientMRN", patient.getMrn());
        ctx.put("admittedAt", visit.getAdmittedAt() != null ? visit.getAdmittedAt().toString() : null);
        ctx.put("primaryDiagnosis", visit.getPrimaryDiagnosis());
        ctx.put("patientSummary", buildPatientSummary(patient, visit, bedEntity));
        return ctx;
    }

    private Map<String, Object> buildPatientSummary(HubPatientEntity patient,
                                                    HubPatientVisitEntity visit,
                                                    HubBedEntity bed) {
        Map<String, Object> snap = visit.getClinicalSnapshot() != null
                ? visit.getClinicalSnapshot() : Map.of();

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("patientName", patient.getFullName());
        summary.put("mrn", patient.getMrn());
        if (patient.getExternalId() != null && !patient.getExternalId().isBlank()) {
            summary.put("externalId", patient.getExternalId());
        }
        if (patient.getDateOfBirth() != null) {
            summary.put("dateOfBirth", patient.getDateOfBirth().toString());
        }
        Integer age = calcAge(patient.getDateOfBirth());
        if (age != null) summary.put("age", age);
        if (patient.getBirthWeightKg() != null) summary.put("weightKg", patient.getBirthWeightKg());
        if (patient.getHeightCm() != null) summary.put("heightCm", patient.getHeightCm());
        if (patient.getSex() != null) summary.put("gender", patient.getSex());
        if (patient.getBloodGroup() != null) summary.put("bloodGroup", patient.getBloodGroup());

        summary.put("bedLabel", bed.getBedLabel());
        if (bed.getUnitId() != null) {
            unitRepository.findById(bed.getUnitId()).ifPresent(u -> {
                summary.put("unitName", u.getName());
                if (u.getBlockName() != null && !u.getBlockName().isBlank()) {
                    summary.put("unitDisplay", u.getBlockName() + " · " + u.getName());
                } else {
                    summary.put("unitDisplay", u.getName());
                }
            });
        }

        if (visit.getAdmissionType() != null) summary.put("admissionType", visit.getAdmissionType());
        if (visit.getAdmissionSource() != null) summary.put("admissionSource", visit.getAdmissionSource());
        if (visit.getReferringPhysician() != null) summary.put("referringPhysician", visit.getReferringPhysician());
        if (visit.getAttendingPhysician() != null) summary.put("attendingPhysician", visit.getAttendingPhysician());
        if (visit.getPrimaryNurse() != null) summary.put("primaryNurse", visit.getPrimaryNurse());
        if (visit.getPrimaryDiagnosis() != null) summary.put("diagnosis", visit.getPrimaryDiagnosis());
        if (visit.getAdmittedAt() != null) summary.put("admittedAt", visit.getAdmittedAt().toString());

        String isolation = formatIsolation(visit.getIsolationFlags());
        if (isolation != null) summary.put("isolationPrecautions", isolation);

        putText(summary, "provisionalDiagnosis", visit.getProvisionalDiagnosis(), snap);
        putText(summary, "pastMedicalHistory", visit.getPastMedicalHistory(), snap);
        putText(summary, "familyHistory", visit.getFamilyHistory(), snap);
        putText(summary, "allergyHistory", visit.getAllergyHistory(), snap);
        putText(summary, "systemicExamination", visit.getSystemicExamination(), snap);

        List<String> comorbidities = visit.getComorbidities();
        if (comorbidities == null || comorbidities.isEmpty()) {
            Object fromSnap = snap.get("comorbidities");
            if (fromSnap instanceof List<?> list) {
                comorbidities = list.stream().map(Object::toString).toList();
            }
        }
        if (comorbidities != null && !comorbidities.isEmpty()) {
            summary.put("comorbidities", comorbidities);
        }

        return summary;
    }

    private void putText(Map<String, Object> summary, String key, String columnVal, Map<String, Object> snap) {
        if (columnVal != null && !columnVal.isBlank()) {
            summary.put(key, columnVal.trim());
            return;
        }
        putSnapText(summary, snap, key);
    }

    private String formatIsolation(Map<String, Object> flags) {
        if (flags == null || flags.isEmpty()) return null;
        List<String> active = new ArrayList<>();
        for (Map.Entry<String, Object> e : flags.entrySet()) {
            if (Boolean.TRUE.equals(e.getValue())) {
                String k = e.getKey();
                active.add(k.substring(0, 1).toUpperCase() + k.substring(1));
            }
        }
        return active.isEmpty() ? "None" : String.join(", ", active);
    }

    private void putSnapText(Map<String, Object> summary, Map<String, Object> snap, String key) {
        Object v = snap.get(key);
        if (v != null && !v.toString().isBlank()) summary.put(key, v.toString().trim());
    }

    private Integer calcAge(LocalDate dob) {
        if (dob == null) return null;
        return Period.between(dob, LocalDate.now()).getYears();
    }

    private VisitContext requireVisit(UUID visitId) {
        HubPatientVisitEntity visit = visitRepository.findById(visitId)
                .orElseThrow(() -> new IllegalArgumentException("Visit not found"));
        HubPatientEntity patient = patientRepository.findById(visit.getPatientId())
                .orElseThrow(() -> new IllegalArgumentException("Patient not found"));
        return new VisitContext(visit, patient);
    }

    public List<Map<String, Object>> listNotes(UUID visitId) {
        requireVisit(visitId);
        return noteRepository.findByVisitIdOrderByUpdatedAtDesc(visitId).stream()
                .map(this::toNoteMap).toList();
    }

    @Transactional
    public Map<String, Object> createNote(UUID visitId, Map<String, Object> request) {
        VisitContext ctx = requireVisit(visitId);
        HubClinicalNoteEntity note = new HubClinicalNoteEntity();
        note.setVisitId(visitId);
        note.setPatientId(ctx.patient.getId());
        note.setBedLabel(stringVal(request.get("bedLabel"), null));
        note.setNoteType(stringVal(request.get("noteType"), "Progress Note"));
        note.setTitle(stringVal(request.get("title"), null));
        note.setContent(stringVal(request.get("content"), ""));
        note.setStatus(stringVal(request.get("status"), "DRAFT"));
        note.setAuthorName(stringVal(request.get("authorName"), "Hub Clinician"));
        noteRepository.save(note);
        return toNoteMap(note);
    }

    @Transactional
    public Map<String, Object> updateNote(UUID noteId, Map<String, Object> request) {
        HubClinicalNoteEntity note = noteRepository.findById(noteId)
                .orElseThrow(() -> new IllegalArgumentException("Note not found"));
        if (request.containsKey("noteType")) note.setNoteType(stringVal(request.get("noteType"), note.getNoteType()));
        if (request.containsKey("title")) note.setTitle(stringVal(request.get("title"), note.getTitle()));
        if (request.containsKey("content")) note.setContent(stringVal(request.get("content"), note.getContent()));
        if (request.containsKey("status")) note.setStatus(stringVal(request.get("status"), note.getStatus()));
        noteRepository.save(note);
        return toNoteMap(note);
    }

    public List<Map<String, Object>> listOrders(UUID visitId) {
        requireVisit(visitId);
        return orderRepository.findByVisitIdOrderByOrderedAtDesc(visitId).stream()
                .map(this::toOrderMap).toList();
    }

    @Transactional
    public Map<String, Object> createOrder(UUID visitId, Map<String, Object> request) {
        VisitContext ctx = requireVisit(visitId);
        String orderType = stringVal(request.get("orderType"), "MEDICATIONS");
        String drugName = stringVal(request.get("drugName"), null);
        String dose = stringVal(request.get("dose"), null);
        String route = stringVal(request.get("route"), null);
        String frequency = stringVal(request.get("frequency"), null);
        String duration = stringVal(request.get("duration"), null);
        String notes = stringVal(request.get("notes"), null);
        String orderText = stringVal(request.get("orderText"), null);
        if (orderText == null) {
            orderText = buildOrderDescription(orderType, drugName, dose, route, frequency, duration);
        }
        if (orderText == null || orderText.isBlank()) {
            throw new IllegalArgumentException("Order description is required");
        }
        HubOrderEntity order = new HubOrderEntity();
        order.setVisitId(visitId);
        order.setPatientId(ctx.patient.getId());
        order.setBedLabel(stringVal(request.get("bedLabel"), null));
        order.setOrderType(orderType);
        order.setOrderText(orderText);
        order.setDrugName(drugName);
        order.setDose(dose);
        order.setRoute(route);
        order.setFrequency(frequency);
        order.setDuration(duration);
        order.setNotes(notes);
        order.setPriority(stringVal(request.get("priority"), "ROUTINE"));
        order.setStatus(stringVal(request.get("status"), "APPROVED"));
        order.setOrderedBy(stringVal(request.get("orderedBy"), "Hub Clinician"));
        Instant orderedAt = parseInstant(request.get("orderedAt"));
        if (orderedAt != null) order.setOrderedAt(orderedAt);
        orderRepository.save(order);
        return toOrderMap(order);
    }

    @Transactional
    public Map<String, Object> updateOrderStatus(UUID orderId, Map<String, Object> request) {
        HubOrderEntity order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found"));
        String status = stringVal(request.get("status"), order.getStatus());
        order.setStatus(status);
        if ("DISCONTINUED".equalsIgnoreCase(status)) {
            order.setDiscontinueReason(stringVal(request.get("discontinueReason"), "Other"));
            order.setDiscontinuedAt(Instant.now());
        }
        String drugName = stringVal(request.get("drugName"), null);
        if (drugName != null) order.setDrugName(drugName);
        String dose = stringVal(request.get("dose"), null);
        if (dose != null) order.setDose(dose);
        String route = stringVal(request.get("route"), null);
        if (route != null) order.setRoute(route);
        String frequency = stringVal(request.get("frequency"), null);
        if (frequency != null) order.setFrequency(frequency);
        String duration = stringVal(request.get("duration"), null);
        if (duration != null) order.setDuration(duration);
        String notes = stringVal(request.get("notes"), null);
        if (notes != null) order.setNotes(notes);
        String priority = stringVal(request.get("priority"), null);
        if (priority != null) order.setPriority(priority);
        if (drugName != null || dose != null || route != null || frequency != null) {
            order.setOrderText(buildOrderDescription(
                    order.getOrderType(), order.getDrugName(), order.getDose(),
                    order.getRoute(), order.getFrequency(), order.getDuration()));
        }
        orderRepository.save(order);
        return toOrderMap(order);
    }

    private String buildOrderDescription(String orderType, String drugName, String dose,
                                         String route, String frequency, String duration) {
        if (drugName != null && !drugName.isBlank()) {
            StringBuilder sb = new StringBuilder(drugName.trim());
            if (dose != null && !dose.isBlank()) sb.append(' ').append(dose.trim());
            if (route != null && !route.isBlank()) sb.append(' ').append(route.trim());
            if (frequency != null && !frequency.isBlank()) sb.append(' ').append(frequency.trim());
            if (duration != null && !duration.isBlank() && !"Until Discontinued".equalsIgnoreCase(duration.trim())) {
                sb.append(" (").append(duration.trim()).append(')');
            }
            return sb.toString().trim();
        }
        return stringVal(orderType, "Order");
    }

    public Map<String, Object> listLabsAndImaging(UUID visitId) {
        requireVisit(visitId);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("labs", labRepository.findByVisitIdOrderByResultedAtDesc(visitId).stream()
                .map(this::toLabMap).toList());
        result.put("imaging", imagingRepository.findByVisitIdOrderByStudyAtDesc(visitId).stream()
                .map(this::toImagingMap).toList());
        return result;
    }

    @Transactional
    public Map<String, Object> createLab(UUID visitId, Map<String, Object> request) {
        VisitContext ctx = requireVisit(visitId);
        String testName = stringVal(request.get("testName"), null);
        if (testName == null) {
            throw new IllegalArgumentException("testName is required");
        }
        HubLabResultEntity lab = new HubLabResultEntity();
        lab.setVisitId(visitId);
        lab.setPatientId(ctx.patient.getId());
        lab.setTestName(testName);
        lab.setValue(stringVal(request.get("value"), null));
        lab.setUnit(stringVal(request.get("unit"), null));
        lab.setReferenceRange(stringVal(request.get("referenceRange"), null));
        lab.setFlag(stringVal(request.get("flag"), null));
        lab.setStatus(stringVal(request.get("status"), "FINAL"));
        Instant resultedAt = parseInstant(request.get("resultedAt"));
        if (resultedAt != null) lab.setResultedAt(resultedAt);
        labRepository.save(lab);
        return toLabMap(lab);
    }

    @Transactional
    public Map<String, Object> createImaging(UUID visitId, Map<String, Object> request) {
        VisitContext ctx = requireVisit(visitId);
        String studyName = stringVal(request.get("studyName"), null);
        String modality = stringVal(request.get("modality"), null);
        if (studyName == null || modality == null) {
            throw new IllegalArgumentException("studyName and modality are required");
        }
        HubImagingStudyEntity study = new HubImagingStudyEntity();
        study.setVisitId(visitId);
        study.setPatientId(ctx.patient.getId());
        study.setModality(modality);
        study.setStudyName(studyName);
        study.setFindings(stringVal(request.get("findings"), null));
        study.setImpression(stringVal(request.get("impression"), null));
        study.setStatus(stringVal(request.get("status"), "FINAL"));
        study.setImageUrl(stringVal(request.get("imageUrl"), null));
        Instant studyAt = parseInstant(request.get("studyAt"));
        if (studyAt != null) study.setStudyAt(studyAt);
        imagingRepository.save(study);
        return toImagingMap(study);
    }

    public Map<String, Object> getPatientHistory(UUID visitId) {
        VisitContext ctx = requireVisit(visitId);
        Map<String, Object> history = new LinkedHashMap<>();
        history.put("visit", Map.of(
                "visitId", ctx.visit.getId().toString(),
                "visitNumber", ctx.visit.getVisitNumber(),
                "admittedAt", ctx.visit.getAdmittedAt() != null ? ctx.visit.getAdmittedAt().toString() : null,
                "status", ctx.visit.getStatus(),
                "primaryDiagnosis", ctx.visit.getPrimaryDiagnosis() != null ? ctx.visit.getPrimaryDiagnosis() : ""
        ));
        history.put("patient", Map.of(
                "patientId", ctx.patient.getId().toString(),
                "fullName", ctx.patient.getFullName(),
                "mrn", ctx.patient.getMrn()
        ));
        history.put("notes", listNotes(visitId));
        history.put("orders", listOrders(visitId));
        history.putAll(listLabsAndImaging(visitId));
        return history;
    }

    private Map<String, Object> toNoteMap(HubClinicalNoteEntity n) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("noteId", n.getId().toString());
        m.put("visitId", n.getVisitId().toString());
        m.put("noteType", n.getNoteType());
        m.put("title", n.getTitle());
        m.put("content", n.getContent());
        m.put("status", n.getStatus());
        m.put("authorName", n.getAuthorName());
        m.put("createdAt", n.getCreatedAt().toString());
        m.put("updatedAt", n.getUpdatedAt().toString());
        return m;
    }

    private Map<String, Object> toOrderMap(HubOrderEntity o) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("orderId", o.getId().toString());
        m.put("visitId", o.getVisitId().toString());
        m.put("orderType", o.getOrderType());
        m.put("orderText", o.getOrderText());
        m.put("description", o.getOrderText());
        m.put("drugName", o.getDrugName());
        m.put("dose", o.getDose());
        m.put("route", o.getRoute());
        m.put("frequency", o.getFrequency());
        m.put("duration", o.getDuration());
        m.put("notes", o.getNotes());
        m.put("priority", o.getPriority());
        m.put("status", o.getStatus());
        m.put("orderedBy", o.getOrderedBy());
        m.put("orderedAt", o.getOrderedAt().toString());
        m.put("discontinueReason", o.getDiscontinueReason());
        m.put("discontinuedAt", o.getDiscontinuedAt() != null ? o.getDiscontinuedAt().toString() : null);
        return m;
    }

    private Map<String, Object> toLabMap(HubLabResultEntity l) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("labId", l.getId().toString());
        m.put("testName", l.getTestName());
        m.put("value", l.getValue());
        m.put("unit", l.getUnit());
        m.put("referenceRange", l.getReferenceRange());
        m.put("flag", l.getFlag());
        m.put("status", l.getStatus());
        m.put("resultedAt", l.getResultedAt().toString());
        return m;
    }

    private Map<String, Object> toImagingMap(HubImagingStudyEntity s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("imagingId", s.getId().toString());
        m.put("modality", s.getModality());
        m.put("studyName", s.getStudyName());
        m.put("findings", s.getFindings());
        m.put("impression", s.getImpression());
        m.put("status", s.getStatus());
        m.put("studyAt", s.getStudyAt().toString());
        m.put("imageUrl", s.getImageUrl());
        return m;
    }

    private String stringVal(Object value, String fallback) {
        if (value == null || value.toString().isBlank()) return fallback;
        return value.toString().trim();
    }

    private Instant parseInstant(Object value) {
        if (value == null || value.toString().isBlank()) return null;
        try {
            return Instant.parse(value.toString());
        } catch (Exception e) {
            try {
                return java.time.LocalDateTime.parse(value.toString().substring(0, Math.min(16, value.toString().length())))
                        .atZone(ZoneId.systemDefault()).toInstant();
            } catch (Exception ex) {
                return null;
            }
        }
    }

    private static String resolveCenterId(String centerId) {
        if (centerId == null || centerId.isBlank()) {
            return DEFAULT_CENTER_ID;
        }
        return centerId.trim().toUpperCase(java.util.Locale.ROOT);
    }

    private record VisitContext(HubPatientVisitEntity visit, HubPatientEntity patient) {}
}
