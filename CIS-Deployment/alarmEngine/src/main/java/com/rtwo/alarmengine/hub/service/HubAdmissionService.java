package com.rtwo.alarmengine.hub.service;

import com.rtwo.alarmengine.dto.DeviceDataMessage;
import com.rtwo.alarmengine.hub.entity.*;
import com.rtwo.alarmengine.hub.repo.*;
import com.rtwo.alarmengine.service.LatestVitalsStore;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.Period;
import java.time.ZoneId;
import java.time.Duration;
import java.util.*;

@Service
public class HubAdmissionService {

    private static final String CENTER_ID = "RTWO";

    private final HubPatientRepository patientRepository;
    private final HubPatientVisitRepository visitRepository;
    private final HubBedRepository bedRepository;
    private final HubUnitRepository unitRepository;
    private final HubBedAssignmentRepository assignmentRepository;
    private final HubAdmissionDraftRepository draftRepository;
    private final HubOrderRepository orderRepository;
    private final HubClinicalNoteRepository noteRepository;
    private final HubLabResultRepository labRepository;
    private final ConnectEngineSyncBridge syncBridge;
    private final MongoTemplate mongoTemplate;
    private final LatestVitalsStore latestVitalsStore;
    private final JdbcTemplate jdbcTemplate;

    public HubAdmissionService(HubPatientRepository patientRepository,
                               HubPatientVisitRepository visitRepository,
                               HubBedRepository bedRepository,
                               HubUnitRepository unitRepository,
                               HubBedAssignmentRepository assignmentRepository,
                               HubAdmissionDraftRepository draftRepository,
                               HubOrderRepository orderRepository,
                               HubClinicalNoteRepository noteRepository,
                               HubLabResultRepository labRepository,
                               ConnectEngineSyncBridge syncBridge,
                               MongoTemplate mongoTemplate,
                               LatestVitalsStore latestVitalsStore,
                               JdbcTemplate jdbcTemplate) {
        this.patientRepository = patientRepository;
        this.visitRepository = visitRepository;
        this.bedRepository = bedRepository;
        this.unitRepository = unitRepository;
        this.assignmentRepository = assignmentRepository;
        this.draftRepository = draftRepository;
        this.orderRepository = orderRepository;
        this.noteRepository = noteRepository;
        this.labRepository = labRepository;
        this.syncBridge = syncBridge;
        this.mongoTemplate = mongoTemplate;
        this.latestVitalsStore = latestVitalsStore;
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<Map<String, Object>> searchPatients(String query) {
        if (query == null || query.trim().length() < 2) {
            return List.of();
        }
        return patientRepository.search(query.trim()).stream().map(this::toPatientSummary).toList();
    }

    public List<Map<String, Object>> listBeds(UUID unitId, boolean allUnits, String centerId) {
        String resolvedCenter = normalizeCenterId(centerId);
        syncBedsFromMongo(resolvedCenter);
        List<HubBedEntity> beds;
        if (unitId != null) {
            if (unitRepository.findById(unitId).isEmpty()) {
                throw new IllegalArgumentException("Unit not found");
            }
            beds = bedRepository.findByCenterIdAndUnitIdAndActiveTrueOrderByBedLabel(resolvedCenter, unitId);
        } else if (allUnits) {
            beds = bedRepository.findByCenterIdAndActiveTrueOrderByBedLabel(resolvedCenter).stream()
                    .filter(b -> b.getUnitId() != null)
                    .toList();
        } else {
            return List.of();
        }
        return beds.stream().map(this::toBedSummary).toList();
    }

    public Map<String, Object> getDischargePreview(String bedLabel, String centerId) {
        String resolvedCenter = normalizeCenterId(centerId);
        if (bedLabel == null || bedLabel.isBlank()) {
            throw new IllegalArgumentException("bedLabel is required");
        }

        HubBedEntity bed = bedRepository.findByCenterIdAndBedLabel(resolvedCenter, bedLabel.trim())
                .orElseThrow(() -> new IllegalArgumentException("Bed not found: " + bedLabel));

        HubBedAssignmentEntity assignment = assignmentRepository.findByBedIdAndActiveTrue(bed.getId())
                .orElseThrow(() -> new IllegalArgumentException("No active patient on bed: " + bedLabel));

        HubPatientVisitEntity visit = visitRepository.findById(assignment.getVisitId())
                .orElseThrow(() -> new IllegalStateException("Visit not found"));

        HubPatientEntity patient = patientRepository.findById(visit.getPatientId())
                .orElseThrow(() -> new IllegalStateException("Patient not found"));

        Instant admittedAt = visit.getAdmittedAt();
        Instant proposedDischarge = Instant.now();
        Map<String, Object> preview = new LinkedHashMap<>();
        preview.put("visitId", visit.getId().toString());
        preview.put("bedLabel", bed.getBedLabel());
        preview.put("deviceIp", bed.getDeviceIp());

        if (bed.getUnitId() != null) {
            unitRepository.findById(bed.getUnitId()).ifPresent(u -> {
                preview.put("unitId", u.getId().toString());
                preview.put("unitName", u.getName());
                preview.put("unitCode", u.getCode());
                if (u.getBlockName() != null && !u.getBlockName().isBlank()) {
                    preview.put("unitDisplay", u.getBlockName() + " · " + u.getName());
                }
            });
        }

        Map<String, Object> patientMap = new LinkedHashMap<>();
        patientMap.put("patientId", patient.getId().toString());
        patientMap.put("fullName", patient.getFullName());
        patientMap.put("mrn", patient.getMrn());
        if (patient.getExternalId() != null) patientMap.put("externalId", patient.getExternalId());
        if (patient.getSex() != null) patientMap.put("sex", patient.getSex());
        if (patient.getDateOfBirth() != null) {
            patientMap.put("dateOfBirth", patient.getDateOfBirth().toString());
            patientMap.put("age", Period.between(patient.getDateOfBirth(), LocalDate.now()).getYears());
        }
        if (patient.getBloodGroup() != null) patientMap.put("bloodGroup", patient.getBloodGroup());
        if (patient.getHeightCm() != null) patientMap.put("heightCm", patient.getHeightCm());
        if (patient.getBirthWeightKg() != null) patientMap.put("weightKg", patient.getBirthWeightKg());
        preview.put("patient", patientMap);

        Map<String, Object> stay = new LinkedHashMap<>();
        stay.put("admissionType", nullToEmpty(visit.getAdmissionType()));
        stay.put("admissionSource", nullToEmpty(visit.getAdmissionSource()));
        stay.put("referringPhysician", nullToEmpty(visit.getReferringPhysician()));
        stay.put("admittedAt", admittedAt != null ? admittedAt.toString() : null);
        stay.put("proposedDischargeAt", proposedDischarge.toString());
        if (admittedAt != null) {
            stay.put("lengthOfStay", formatLengthOfStay(admittedAt, proposedDischarge));
            stay.put("lengthOfStayHours", Duration.between(admittedAt, proposedDischarge).toHours());
        }
        preview.put("stay", stay);

        Map<String, Object> snap = visit.getClinicalSnapshot() != null ? visit.getClinicalSnapshot() : Map.of();
        Map<String, Object> clinical = new LinkedHashMap<>();
        clinical.put("primaryDiagnosis", textOrNull(visit.getPrimaryDiagnosis(), snap.get("provisionalDiagnosis")));
        clinical.put("provisionalDiagnosis", textOrNull(visit.getProvisionalDiagnosis(), snap.get("provisionalDiagnosis")));
        clinical.put("allergyHistory", textOrNull(visit.getAllergyHistory(), snap.get("allergyHistory")));
        clinical.put("pastMedicalHistory", textOrNull(visit.getPastMedicalHistory(), snap.get("pastMedicalHistory")));
        clinical.put("familyHistory", textOrNull(visit.getFamilyHistory(), snap.get("familyHistory")));
        clinical.put("systemicExamination", textOrNull(visit.getSystemicExamination(), snap.get("systemicExamination")));
        List<String> comorbidities = visit.getComorbidities();
        if (comorbidities == null || comorbidities.isEmpty()) {
            Object fromSnap = snap.get("comorbidities");
            if (fromSnap instanceof List<?> list) {
                comorbidities = list.stream().map(Object::toString).toList();
            }
        }
        clinical.put("comorbidities", comorbidities != null ? comorbidities : List.of());
        clinical.put("isolationPrecautions", formatIsolation(visit.getIsolationFlags()));
        clinical.put("admissionSnapshot", extractVitalsSnapshot(snap));
        preview.put("clinical", clinical);

        if (visit.getDeviceMapping() != null && !visit.getDeviceMapping().isEmpty()) {
            preview.put("devices", visit.getDeviceMapping());
        }

        UUID visitId = visit.getId();
        List<Map<String, Object>> activeOrders = orderRepository.findByVisitIdOrderByOrderedAtDesc(visitId).stream()
                .filter(o -> o.getStatus() == null || !"DISCONTINUED".equalsIgnoreCase(o.getStatus()))
                .limit(12)
                .map(o -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("orderType", o.getOrderType());
                    m.put("orderText", o.getOrderText());
                    m.put("status", o.getStatus());
                    m.put("priority", o.getPriority());
                    m.put("orderedAt", o.getOrderedAt().toString());
                    return m;
                })
                .toList();
        preview.put("activeOrders", activeOrders);
        preview.put("activeOrderCount", activeOrders.size());

        List<Map<String, Object>> recentNotes = noteRepository.findByVisitIdOrderByUpdatedAtDesc(visitId).stream()
                .limit(5)
                .map(n -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("noteType", n.getNoteType());
                    m.put("title", n.getTitle());
                    m.put("authorName", n.getAuthorName());
                    m.put("updatedAt", n.getUpdatedAt().toString());
                    String content = n.getContent();
                    if (content != null && content.length() > 200) {
                        m.put("excerpt", content.substring(0, 200) + "…");
                    } else {
                        m.put("excerpt", content);
                    }
                    return m;
                })
                .toList();
        preview.put("recentNotes", recentNotes);

        List<Map<String, Object>> recentLabs = labRepository.findByVisitIdOrderByResultedAtDesc(visitId).stream()
                .limit(6)
                .map(l -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("testName", l.getTestName());
                    m.put("value", l.getValue());
                    m.put("unit", l.getUnit());
                    m.put("flag", l.getFlag());
                    m.put("resultedAt", l.getResultedAt().toString());
                    return m;
                })
                .toList();
        preview.put("recentLabs", recentLabs);

        DeviceDataMessage live = latestVitalsStore.get(bed.getBedLabel());
        if (live != null) {
            Map<String, Object> vitals = new LinkedHashMap<>();
            vitals.put("timestamp", live.getTimestamp());
            if (live.getPrimaryAttributes() != null) {
                for (DeviceDataMessage.VitalAttribute attr : live.getPrimaryAttributes()) {
                    String name = attr.getParamName();
                    Object value = attr.getValue();
                    if (name != null && value != null) {
                        vitals.put(name, value);
                    }
                }
            }
            preview.put("latestVitals", vitals);
        }

        return preview;
    }

    private String nullToEmpty(String value) {
        return value != null ? value : "";
    }

    private String textOrNull(String column, Object snapVal) {
        if (column != null && !column.isBlank()) return column.trim();
        if (snapVal != null && !snapVal.toString().isBlank()) return snapVal.toString().trim();
        return null;
    }

    private String formatLengthOfStay(Instant admitted, Instant discharge) {
        long totalHours = Duration.between(admitted, discharge).toHours();
        long days = totalHours / 24;
        long hours = totalHours % 24;
        if (days > 0) {
            return days + " day" + (days == 1 ? "" : "s") + (hours > 0 ? " " + hours + " hr" : "");
        }
        long minutes = Duration.between(admitted, discharge).toMinutes() % 60;
        if (totalHours > 0) return totalHours + " hr" + (minutes > 0 ? " " + minutes + " min" : "");
        return Math.max(1, Duration.between(admitted, discharge).toMinutes()) + " min";
    }

    private String formatIsolation(Map<String, Object> flags) {
        if (flags == null || flags.isEmpty()) return "None";
        List<String> active = new ArrayList<>();
        for (Map.Entry<String, Object> e : flags.entrySet()) {
            if (Boolean.TRUE.equals(e.getValue())) {
                String k = e.getKey();
                active.add(k.substring(0, 1).toUpperCase() + k.substring(1));
            }
        }
        return active.isEmpty() ? "None" : String.join(", ", active);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> extractVitalsSnapshot(Map<String, Object> snap) {
        Map<String, Object> vitals = new LinkedHashMap<>();
        for (String key : List.of("hr", "bp", "spo2", "rr", "temp", "gcs", "painScore")) {
            Object v = snap.get(key);
            if (v != null && !v.toString().isBlank()) vitals.put(key, v);
        }
        for (String key : List.of("ventilated", "inotropes", "dialysis")) {
            if (Boolean.TRUE.equals(snap.get(key))) vitals.put(key, true);
        }
        return vitals;
    }

    @Transactional
    public Map<String, Object> saveDraft(Map<String, Object> request) {
        HubAdmissionDraftEntity draft = new HubAdmissionDraftEntity();
        draft.setWorkflowType(stringVal(request.get("workflowType"), "NEW_ADMISSION"));
        Object patientId = request.get("patientId");
        if (patientId != null && !patientId.toString().isBlank()) {
            draft.setPatientId(UUID.fromString(patientId.toString()));
        }
        @SuppressWarnings("unchecked")
        Map<String, Object> payload = request.get("payload") instanceof Map<?, ?> m
                ? (Map<String, Object>) m : request;
        draft.setPayload(payload);
        draftRepository.save(draft);
        return Map.of("draftId", draft.getId().toString(), "status", "saved");
    }

    @Transactional
    public Map<String, Object> admitNew(Map<String, Object> request, String centerId) {
        return admitInternal(request, false, centerId);
    }

    @Transactional
    public Map<String, Object> readmit(Map<String, Object> request, String centerId) {
        String patientId = stringVal(request.get("patientId"), null);
        if (patientId == null) {
            throw new IllegalArgumentException("patientId is required for readmission");
        }
        HubPatientEntity patient = patientRepository.findById(UUID.fromString(patientId))
                .orElseThrow(() -> new IllegalArgumentException("Patient not found"));
        request.put("mrn", patient.getMrn());
        request.put("fullName", patient.getFullName());
        return admitInternal(request, true, centerId);
    }

    @Transactional
    public Map<String, Object> discharge(Map<String, Object> request, String centerId) {
        String resolvedCenter = normalizeCenterId(centerId);
        String bedLabel = stringVal(request.get("bedLabel"), null);
        if (bedLabel == null) {
            throw new IllegalArgumentException("bedLabel is required");
        }

        HubBedEntity bed = bedRepository.findByCenterIdAndBedLabel(resolvedCenter, bedLabel)
                .orElseThrow(() -> new IllegalArgumentException("Bed not found: " + bedLabel));

        HubBedAssignmentEntity assignment = assignmentRepository.findByBedIdAndActiveTrue(bed.getId())
                .orElseThrow(() -> new IllegalArgumentException("No active patient on bed: " + bedLabel));

        HubPatientVisitEntity visit = visitRepository.findById(assignment.getVisitId())
                .orElseThrow(() -> new IllegalStateException("Visit not found"));

        Instant dischargedAt = parseInstant(request.get("dischargedAt"));
        visit.setStatus("DISCHARGED");
        visit.setDischargedAt(dischargedAt);
        String reason = stringVal(request.get("dischargeReason"), null);
        if (reason != null) {
            visit.setDischargeReason(reason);
        }
        String destination = stringVal(request.get("dischargeDestination"), null);
        if (destination != null) {
            visit.setDischargeDestination(destination);
        }
        String followUp = stringVal(request.get("followUpPlan"), null);
        if (followUp != null) {
            visit.setFollowUpPlan(followUp);
        }
        visitRepository.save(visit);

        assignment.setActive(false);
        assignment.setReleasedAt(dischargedAt);
        assignmentRepository.save(assignment);

        syncBridge.syncDischarge(bedLabel, bed.getCenterId());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("bedLabel", bedLabel);
        result.put("visitId", visit.getId().toString());
        result.put("status", "discharged");
        result.put("message", "Patient discharged — Postgres saved, Mongo mirror synced.");
        return result;
    }

    private Map<String, Object> admitInternal(Map<String, Object> request, boolean readmit, String centerId) {
        String resolvedCenter = normalizeCenterId(centerId);
        String bedLabel = stringVal(request.get("bedLabel"), null);
        String fullName = stringVal(request.get("fullName"), stringVal(request.get("name"), null));
        String mrn = stringVal(request.get("mrn"), null);
        String gender = stringVal(request.get("gender"), stringVal(request.get("sex"), "M"));

        if (bedLabel == null || fullName == null || mrn == null) {
            throw new IllegalArgumentException("bedLabel, fullName, and mrn are required");
        }

        syncBedsFromMongo(resolvedCenter);
        HubBedEntity bed = bedRepository.findByCenterIdAndBedLabel(resolvedCenter, bedLabel)
                .orElseThrow(() -> new IllegalArgumentException("Bed not found: " + bedLabel));

        String unitIdStr = stringVal(request.get("unitId"), null);
        if (unitIdStr != null && bed.getUnitId() != null
                && !bed.getUnitId().equals(UUID.fromString(unitIdStr))) {
            throw new IllegalArgumentException("Bed " + bedLabel + " is not in the selected unit");
        }

        assignmentRepository.findByBedIdAndActiveTrue(bed.getId()).ifPresent(a -> {
            throw new IllegalArgumentException("Bed is occupied: " + bedLabel);
        });

        HubPatientEntity patient;
        if (readmit) {
            patient = patientRepository.findByMrn(mrn)
                    .orElseThrow(() -> new IllegalArgumentException("Patient not found for readmit"));
            applyDemographics(patient, request);
        } else {
            if (patientRepository.findByMrn(mrn).isPresent()) {
                throw new IllegalArgumentException("MRN already exists — use Readmission tab");
            }
            patient = new HubPatientEntity();
            patient.setMrn(mrn);
            applyDemographics(patient, request);
        }
        patientRepository.save(patient);

        int visitNum = (int) visitRepository.countByPatientId(patient.getId()) + 1;
        HubPatientVisitEntity visit = new HubPatientVisitEntity();
        visit.setPatientId(patient.getId());
        visit.setVisitNumber(visitNum);
        visit.setAdmissionType(stringVal(request.get("admissionType"), "Medical"));
        visit.setAdmissionSource(stringVal(request.get("admissionSource"), null));
        visit.setReferringPhysician(stringVal(request.get("referringPhysician"), null));
        visit.setPrimaryDiagnosis(stringVal(request.get("primaryDiagnosis"), null));
        visit.setIsolationFlags(mapVal(request.get("isolationFlags")));
        visit.setAdmittedAt(parseInstant(request.get("admissionDateTime")));
        applyVisitAssessment(visit, request);
        visit.setClinicalSnapshot(enrichClinicalSnapshot(request));
        visit.setConsent(mapVal(request.get("consent")));
        visit.setDeviceMapping(mapVal(request.get("deviceMapping")));
        visit.setStatus("ACTIVE");
        visitRepository.save(visit);

        HubBedAssignmentEntity assignment = new HubBedAssignmentEntity();
        assignment.setVisitId(visit.getId());
        assignment.setBedId(bed.getId());
        assignment.setAssignedAt(visit.getAdmittedAt());
        assignment.setActive(true);
        assignmentRepository.save(assignment);

        List<String> deviceIds = parseDeviceIds(request.get("devices"));
        syncBridge.syncAdmission(patient, visit, bed, deviceIds, gender);
        patientRepository.save(patient);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("patientId", patient.getId().toString());
        result.put("visitId", visit.getId().toString());
        result.put("bedLabel", bedLabel);
        result.put("patientName", patient.getFullName());
        result.put("patientMRN", patient.getMrn());
        result.put("status", readmit ? "readmitted" : "admitted");
        result.put("message", readmit
                ? "Patient readmitted — Postgres master saved, Mongo synced for Connect Engine."
                : "Patient admitted — Postgres master saved, Mongo synced for Connect Engine.");
        return result;
    }

    private void applyDemographics(HubPatientEntity patient, Map<String, Object> request) {
        patient.setFullName(stringVal(request.get("fullName"), stringVal(request.get("name"), patient.getFullName())));
        patient.setExternalId(stringVal(request.get("externalId"), patient.getExternalId()));
        patient.setSex(stringVal(request.get("gender"), stringVal(request.get("sex"), patient.getSex())));
        LocalDate dob = parseDate(request.get("dateOfBirth"));
        if (dob != null) patient.setDateOfBirth(dob);
        Double weight = doubleVal(request.get("weight"));
        if (weight == null) weight = doubleVal(request.get("birthWeightKg"));
        if (weight != null) patient.setBirthWeightKg(weight);
        Double height = doubleVal(request.get("height"));
        if (height == null) height = doubleVal(request.get("heightCm"));
        if (height != null) patient.setHeightCm(height);
        String bloodGroup = stringVal(request.get("bloodGroup"), null);
        if (bloodGroup != null) patient.setBloodGroup(bloodGroup);
        if (patient.getExternalId() == null || patient.getExternalId().isBlank()) {
            patient.setExternalId(patient.getMrn());
        }
    }

    public void syncBedsFromMongo(String centerId) {
        String resolvedCenter = normalizeCenterId(centerId);
        Document center = mongoTemplate.findOne(
                new Query(Criteria.where("_id").is(resolvedCenter)), Document.class, "centerEntity");
        if (center == null) return;

        ensureCenterInPostgres(resolvedCenter, center);

        Object bedsObj = center.get("beds");
        if (!(bedsObj instanceof List<?> list)) return;

        for (Object item : list) {
            if (!(item instanceof Document mongoBed)) continue;
            String label = mongoBed.getString("bedLabel");
            if (label == null || label.isBlank()) continue;

            HubBedEntity hubBed = bedRepository.findByCenterIdAndBedLabel(resolvedCenter, label)
                    .orElseGet(() -> {
                        HubBedEntity b = new HubBedEntity();
                        b.setCenterId(resolvedCenter);
                        b.setBedLabel(label);
                        return b;
                    });
            syncBridge.ensureBedInPostgresFromMongo(hubBed, mongoBed);
            bedRepository.save(hubBed);
        }
    }

    private void ensureCenterInPostgres(String centerId, Document mongoCenter) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM hub_centers WHERE id = ?", Integer.class, centerId);
        if (count != null && count > 0) return;

        String name = mongoCenter != null ? mongoCenter.getString("name") : null;
        if (name == null || name.isBlank()) name = centerId;
        String location = mongoCenter != null ? mongoCenter.getString("location") : null;
        jdbcTemplate.update(
                "INSERT INTO hub_centers (id, name, location, status) VALUES (?, ?, ?, 'ACTIVE')",
                centerId, name, location);
    }

    private String normalizeCenterId(String centerId) {
        if (centerId == null || centerId.isBlank()) return CENTER_ID;
        return centerId.trim().toUpperCase(Locale.ROOT);
    }

    private Map<String, Object> toPatientSummary(HubPatientEntity p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("patientId", p.getId().toString());
        m.put("mrn", p.getMrn());
        m.put("externalId", p.getExternalId());
        m.put("fullName", p.getFullName());
        m.put("sex", p.getSex());
        m.put("dateOfBirth", p.getDateOfBirth() != null ? p.getDateOfBirth().toString() : null);
        m.put("weightKg", p.getBirthWeightKg());
        m.put("heightCm", p.getHeightCm());
        m.put("bloodGroup", p.getBloodGroup());
        return m;
    }

    private void applyVisitAssessment(HubPatientVisitEntity visit, Map<String, Object> request) {
        visit.setProvisionalDiagnosis(stringVal(request.get("provisionalDiagnosis"), null));
        visit.setAllergyHistory(stringVal(request.get("allergyHistory"), null));
        visit.setPastMedicalHistory(stringVal(request.get("pastMedicalHistory"), null));
        visit.setFamilyHistory(stringVal(request.get("familyHistory"), null));
        visit.setSystemicExamination(stringVal(request.get("systemicExamination"), null));
        List<String> comorbidities = stringListVal(request.get("comorbidities"));
        if (!comorbidities.isEmpty()) {
            visit.setComorbidities(comorbidities);
        }
    }

    private Map<String, Object> toBedSummary(HubBedEntity b) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("bedId", b.getId().toString());
        m.put("bedLabel", b.getBedLabel());
        m.put("deviceIp", b.getDeviceIp());
        m.put("unitId", b.getUnitId() != null ? b.getUnitId().toString() : null);
        if (b.getUnitId() != null) {
            unitRepository.findById(b.getUnitId()).ifPresent(u -> {
                m.put("unitCode", u.getCode());
                m.put("unitName", u.getName());
            });
        }
        m.put("occupied", assignmentRepository.findByBedIdAndActiveTrue(b.getId()).isPresent());
        assignmentRepository.findByBedIdAndActiveTrue(b.getId()).ifPresent(a ->
                visitRepository.findById(a.getVisitId()).ifPresent(v ->
                        patientRepository.findById(v.getPatientId()).ifPresent(p -> {
                            m.put("visitId", v.getId().toString());
                            m.put("patientId", p.getId().toString());
                            m.put("patientName", p.getFullName());
                            m.put("mrn", p.getMrn());
                            m.put("primaryDiagnosis", v.getPrimaryDiagnosis());
                            m.put("admissionType", v.getAdmissionType());
                            m.put("admittedAt", v.getAdmittedAt().toString());
                            if (v.getComorbidities() != null && !v.getComorbidities().isEmpty()) {
                                m.put("comorbidities", v.getComorbidities());
                            }
                        })));
        return m;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> enrichClinicalSnapshot(Map<String, Object> request) {
        Map<String, Object> snap = new LinkedHashMap<>();
        Map<String, Object> existing = mapVal(request.get("clinicalSnapshot"));
        if (existing != null) snap.putAll(existing);

        List<String> comorbidities = stringListVal(request.get("comorbidities"));
        if (!comorbidities.isEmpty()) snap.put("comorbidities", comorbidities);

        putIfPresent(snap, "systemicExamination", request.get("systemicExamination"));
        putIfPresent(snap, "allergyHistory", request.get("allergyHistory"));
        putIfPresent(snap, "pastMedicalHistory", request.get("pastMedicalHistory"));
        putIfPresent(snap, "familyHistory", request.get("familyHistory"));
        putIfPresent(snap, "provisionalDiagnosis", request.get("provisionalDiagnosis"));

        return snap.isEmpty() ? null : snap;
    }

    private void putIfPresent(Map<String, Object> snap, String key, Object value) {
        String s = stringVal(value, null);
        if (s != null) snap.put(key, s);
    }

    @SuppressWarnings("unchecked")
    private List<String> stringListVal(Object value) {
        List<String> out = new ArrayList<>();
        if (value instanceof List<?> list) {
            for (Object item : list) {
                if (item != null && !item.toString().isBlank()) out.add(item.toString().trim());
            }
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> mapVal(Object o) {
        return o instanceof Map<?, ?> m ? (Map<String, Object>) m : null;
    }

    @SuppressWarnings("unchecked")
    private List<String> parseDeviceIds(Object devicesObj) {
        List<String> ids = new ArrayList<>();
        if (devicesObj instanceof List<?> list) {
            for (Object item : list) {
                if (item != null && !item.toString().isBlank()) ids.add(item.toString());
            }
        }
        if (ids.isEmpty() && devicesObj instanceof Map<?, ?> map) {
            for (Object v : map.values()) {
                if (v != null && !v.toString().isBlank()) ids.add(v.toString());
            }
        }
        return ids;
    }

    private String stringVal(Object value, String fallback) {
        if (value == null || value.toString().isBlank()) return fallback;
        return value.toString().trim();
    }

    private Double doubleVal(Object value) {
        if (value == null) return null;
        if (value instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(value.toString()); }
        catch (NumberFormatException e) { return null; }
    }

    private LocalDate parseDate(Object value) {
        if (value == null || value.toString().isBlank()) return null;
        try {
            return LocalDate.parse(value.toString().substring(0, Math.min(10, value.toString().length())));
        } catch (Exception e) {
            return null;
        }
    }

    private Instant parseInstant(Object value) {
        if (value == null || value.toString().isBlank()) return Instant.now();
        try {
            return Instant.parse(value.toString());
        } catch (Exception e) {
            try {
                return LocalDate.parse(value.toString().substring(0, 10))
                        .atStartOfDay(ZoneId.systemDefault()).toInstant();
            } catch (Exception ex) {
                return Instant.now();
            }
        }
    }
}
