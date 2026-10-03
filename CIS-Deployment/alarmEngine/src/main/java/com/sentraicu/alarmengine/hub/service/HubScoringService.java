package com.sentraicu.alarmengine.hub.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sentraicu.alarmengine.hub.entity.*;
import com.sentraicu.alarmengine.hub.repo.*;
import com.sentraicu.alarmengine.hub.scoring.HubScoringCalculator;
import com.sentraicu.alarmengine.hub.scoring.HubScoringDataResolver;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class HubScoringService {

    private static final List<String> SCORE_TYPES = List.of(
            "NEWS2", "SOFA", "APACHE_II", "RASS", "CAM_ICU"
    );

    private final HubScoreSnapshotRepository snapshotRepository;
    private final HubPatientVisitRepository visitRepository;
    private final HubPatientRepository patientRepository;
    private final HubBedAssignmentRepository assignmentRepository;
    private final HubBedRepository bedRepository;
    private final HubUnitRepository unitRepository;
    private final HubScoringDataResolver dataResolver;
    private final ObjectMapper objectMapper;

    public HubScoringService(HubScoreSnapshotRepository snapshotRepository,
                             HubPatientVisitRepository visitRepository,
                             HubPatientRepository patientRepository,
                             HubBedAssignmentRepository assignmentRepository,
                             HubBedRepository bedRepository,
                             HubUnitRepository unitRepository,
                             HubScoringDataResolver dataResolver,
                             ObjectMapper objectMapper) {
        this.snapshotRepository = snapshotRepository;
        this.visitRepository = visitRepository;
        this.patientRepository = patientRepository;
        this.assignmentRepository = assignmentRepository;
        this.bedRepository = bedRepository;
        this.unitRepository = unitRepository;
        this.dataResolver = dataResolver;
        this.objectMapper = objectMapper;
    }

    public List<Map<String, Object>> getDashboard(String centerId) {
        List<Map<String, Object>> rows = new ArrayList<>();
        List<HubBedEntity> beds = bedRepository.findByCenterIdAndActiveTrueOrderByBedLabel(centerId);
        for (HubBedEntity bed : beds) {
            Optional<HubBedAssignmentEntity> assignment =
                    assignmentRepository.findByBedIdAndActiveTrue(bed.getId());
            if (assignment.isEmpty()) continue;

            HubPatientVisitEntity visit = visitRepository.findById(assignment.get().getVisitId()).orElse(null);
            if (visit == null) continue;
            HubPatientEntity patient = patientRepository.findById(visit.getPatientId()).orElse(null);
            if (patient == null) continue;

            String unitName = "";
            if (bed.getUnitId() != null) {
                unitName = unitRepository.findById(bed.getUnitId()).map(HubUnitEntity::getName).orElse("");
            }

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("visitId", visit.getId().toString());
            row.put("patientId", patient.getId().toString());
            row.put("patientName", patient.getFullName());
            row.put("mrn", patient.getMrn());
            row.put("bedLabel", bed.getBedLabel());
            row.put("bedId", "ICU-1-" + bed.getBedLabel());
            row.put("unitName", unitName);
            row.put("admittedAt", visit.getAdmittedAt().toString());

            Map<String, Object> latestScores = new LinkedHashMap<>();
            for (String type : SCORE_TYPES) {
                snapshotRepository.findTop1ByVisitIdAndScoreTypeOrderByCalculatedAtDesc(visit.getId(), type)
                        .ifPresent(s -> latestScores.put(type, snapshotToSummary(s)));
            }
            row.put("latestScores", latestScores);
            rows.add(row);
        }
        return rows;
    }

    public Map<String, Object> autofill(UUID visitId, String scoreType) {
        return dataResolver.resolveAutoFill(visitId, scoreType);
    }

    public Map<String, Object> preview(UUID visitId, String scoreType, Map<String, Object> request) {
        validateApacheWindow(visitId, scoreType);
        @SuppressWarnings("unchecked")
        Map<String, Object> inputs = request.containsKey("inputs")
                ? (Map<String, Object>) request.get("inputs")
                : request;
        Map<String, Object> computed = HubScoringCalculator.compute(scoreType, inputs);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("visitId", visitId.toString());
        result.put("scoreType", HubScoringCalculator.normalizeType(scoreType));
        result.put("inputs", inputs);
        result.putAll(computed);
        return result;
    }

    @Transactional
    public Map<String, Object> save(UUID visitId, String scoreType, Map<String, Object> request) {
        validateApacheWindow(visitId, scoreType);

        HubPatientVisitEntity visit = visitRepository.findById(visitId)
                .orElseThrow(() -> new IllegalArgumentException("Visit not found"));
        HubPatientEntity patient = patientRepository.findById(visit.getPatientId())
                .orElseThrow(() -> new IllegalArgumentException("Patient not found"));

        @SuppressWarnings("unchecked")
        Map<String, Object> inputs = request.containsKey("inputs")
                ? (Map<String, Object>) request.get("inputs")
                : request;

        Map<String, Object> computed = HubScoringCalculator.compute(scoreType, inputs);
        String normalizedType = HubScoringCalculator.normalizeType(scoreType);

        HubScoreSnapshotEntity entity = new HubScoreSnapshotEntity();
        entity.setVisitId(visitId);
        entity.setPatientId(patient.getId());
        entity.setBedLabel(resolveBedLabel(visitId));
        entity.setScoreType(normalizedType);
        entity.setTotalScore(BigDecimal.valueOf(toDouble(computed.get("totalScore"))));
        entity.setInterpretation(stringVal(computed.get("interpretation")));
        entity.setRiskLevel(stringVal(computed.get("riskLevel")));
        entity.setInputsJson(toJson(inputs));
        entity.setBreakdownJson(toJson(computed.get("breakdown")));
        entity.setSource(stringVal(request.get("source"), "MIXED"));
        entity.setNotes(stringVal(request.get("notes")));
        entity.setRecordedBy(stringVal(request.get("recordedBy")));
        if (request.containsKey("calculatedAt") && request.get("calculatedAt") != null) {
            entity.setCalculatedAt(Instant.parse(request.get("calculatedAt").toString()));
        }

        snapshotRepository.save(entity);

        Map<String, Object> result = snapshotToMap(entity);
        result.put("breakdown", computed.get("breakdown"));
        if (computed.containsKey("camPositive")) {
            result.put("camPositive", computed.get("camPositive"));
        }
        return result;
    }

    public List<Map<String, Object>> getHistory(UUID visitId, String scoreType, Instant from) {
        String type = HubScoringCalculator.normalizeType(scoreType);
        List<HubScoreSnapshotEntity> list = from != null
                ? snapshotRepository.findHistory(visitId, type, from)
                : snapshotRepository.findByVisitIdAndScoreTypeOrderByCalculatedAtDesc(visitId, type);

        List<HubScoreSnapshotEntity> ordered = new ArrayList<>(list);
        if (from == null) {
            ordered.sort(Comparator.comparing(HubScoreSnapshotEntity::getCalculatedAt));
        }

        return ordered.stream().map(this::snapshotToMap).toList();
    }

    public List<String> scoreTypes() {
        return SCORE_TYPES;
    }

    private void validateApacheWindow(UUID visitId, String scoreType) {
        if (!"APACHE_II".equals(HubScoringCalculator.normalizeType(scoreType))) return;
        HubPatientVisitEntity visit = visitRepository.findById(visitId)
                .orElseThrow(() -> new IllegalArgumentException("Visit not found"));
        Instant windowEnd = visit.getAdmittedAt().plus(24, ChronoUnit.HOURS);
        if (Instant.now().isAfter(windowEnd)) {
            throw new IllegalArgumentException(
                    "APACHE II can only be calculated within the first 24 hours of ICU admission");
        }
    }

    private String resolveBedLabel(UUID visitId) {
        return assignmentRepository.findByVisitIdAndActiveTrue(visitId)
                .flatMap(a -> bedRepository.findById(a.getBedId()))
                .map(HubBedEntity::getBedLabel)
                .orElse(null);
    }

    private Map<String, Object> snapshotToSummary(HubScoreSnapshotEntity s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", s.getId().toString());
        m.put("totalScore", s.getTotalScore());
        m.put("riskLevel", s.getRiskLevel());
        m.put("interpretation", s.getInterpretation());
        m.put("calculatedAt", s.getCalculatedAt().toString());
        return m;
    }

    private Map<String, Object> snapshotToMap(HubScoreSnapshotEntity s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", s.getId().toString());
        m.put("visitId", s.getVisitId().toString());
        m.put("patientId", s.getPatientId().toString());
        m.put("bedLabel", s.getBedLabel());
        m.put("scoreType", s.getScoreType());
        m.put("totalScore", s.getTotalScore());
        m.put("interpretation", s.getInterpretation());
        m.put("riskLevel", s.getRiskLevel());
        m.put("source", s.getSource());
        m.put("notes", s.getNotes());
        m.put("recordedBy", s.getRecordedBy());
        m.put("calculatedAt", s.getCalculatedAt().toString());
        m.put("createdAt", s.getCreatedAt().toString());
        m.put("inputs", fromJson(s.getInputsJson()));
        m.put("breakdown", fromJson(s.getBreakdownJson()));
        return m;
    }

    private String toJson(Object value) {
        if (value == null) return null;
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("JSON serialization failed", e);
        }
    }

    private Object fromJson(String json) {
        if (json == null || json.isBlank()) return Map.of();
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (JsonProcessingException e) {
            return Map.of();
        }
    }

    private double toDouble(Object v) {
        if (v == null) return 0;
        if (v instanceof Number n) return n.doubleValue();
        try {
            return Double.parseDouble(v.toString());
        } catch (Exception e) {
            return 0;
        }
    }

    private String stringVal(Object v) {
        return v == null ? null : v.toString().trim();
    }

    private String stringVal(Object v, String fallback) {
        String s = stringVal(v);
        return s == null || s.isBlank() ? fallback : s;
    }
}
