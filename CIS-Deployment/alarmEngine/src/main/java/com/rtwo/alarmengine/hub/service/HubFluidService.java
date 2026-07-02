package com.rtwo.alarmengine.hub.service;

import com.rtwo.alarmengine.hub.entity.*;
import com.rtwo.alarmengine.hub.repo.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class HubFluidService {

    private final HubFluidEntryRepository fluidRepository;
    private final HubPatientVisitRepository visitRepository;
    private final HubPatientRepository patientRepository;

    public HubFluidService(HubFluidEntryRepository fluidRepository,
                           HubPatientVisitRepository visitRepository,
                           HubPatientRepository patientRepository) {
        this.fluidRepository = fluidRepository;
        this.visitRepository = visitRepository;
        this.patientRepository = patientRepository;
    }

    public List<Map<String, Object>> listForVisit(UUID visitId, Instant from, Instant to) {
        requireVisit(visitId);
        return fluidRepository.findByVisitIdAndRecordedAtBetweenOrderByRecordedAtAsc(visitId, from, to)
                .stream().map(this::toMap).toList();
    }

    @Transactional
    public Map<String, Object> create(UUID visitId, Map<String, Object> request) {
        HubPatientVisitEntity visit = visitRepository.findById(visitId)
                .orElseThrow(() -> new IllegalArgumentException("Visit not found"));
        HubPatientEntity patient = patientRepository.findById(visit.getPatientId())
                .orElseThrow(() -> new IllegalArgumentException("Patient not found"));

        HubFluidEntryEntity entry = new HubFluidEntryEntity();
        entry.setVisitId(visitId);
        entry.setPatientId(patient.getId());
        entry.setBedLabel(stringVal(request.get("bedLabel"), null));
        String entryType = stringVal(request.get("entryType"), "INTAKE").toUpperCase();
        entry.setEntryType(entryType);
        entry.setCategory(stringVal(request.get("category"), "Other"));
        entry.setFluidName(stringVal(request.get("fluidName"), "Fluid"));
        entry.setNotes(stringVal(request.get("notes"), null));
        entry.setRecordedBy(stringVal(request.get("recordedBy"), "Nursing"));
        entry.setUnit("ml");

        String intakeMode = stringVal(request.get("intakeMode"), "ONE_TIME").toUpperCase();
        boolean runningIntake = "INTAKE".equals(entryType) && "RUNNING".equals(intakeMode);

        if (runningIntake) {
            Object rateObj = request.get("rateMlPerHr");
            if (rateObj == null || rateObj.toString().isBlank()) {
                throw new IllegalArgumentException("Rate (ml/hr) is required for running intake");
            }
            BigDecimal rate = new BigDecimal(rateObj.toString());
            if (rate.compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException("Rate must be greater than zero");
            }
            Instant startedAt = parseInstant(request.get("recordedAt"));
            if (startedAt == null) startedAt = Instant.now();

            entry.setIntakeMode("RUNNING");
            entry.setRateMlPerHr(rate);
            entry.setStartedAt(startedAt);
            entry.setRecordedAt(startedAt);
            entry.setRunningStatus("ACTIVE");
            entry.setVolumeMl(BigDecimal.ZERO);
        } else {
            entry.setIntakeMode("ONE_TIME");
            Object vol = request.get("volumeMl");
            if (vol != null && !vol.toString().isBlank()) {
                entry.setVolumeMl(new BigDecimal(vol.toString()));
            }
            Instant recordedAt = parseInstant(request.get("recordedAt"));
            entry.setRecordedAt(recordedAt != null ? recordedAt : Instant.now());
        }

        fluidRepository.save(entry);
        return toMap(entry);
    }

    @Transactional
    public Map<String, Object> stopRunning(UUID entryId) {
        HubFluidEntryEntity entry = fluidRepository.findById(entryId)
                .orElseThrow(() -> new IllegalArgumentException("Fluid entry not found"));
        if (!"RUNNING".equalsIgnoreCase(entry.getIntakeMode())) {
            throw new IllegalArgumentException("Entry is not a running intake");
        }
        if (!"ACTIVE".equalsIgnoreCase(entry.getRunningStatus())) {
            throw new IllegalArgumentException("Running intake is already stopped");
        }
        Instant stoppedAt = Instant.now();
        entry.setStoppedAt(stoppedAt);
        entry.setRunningStatus("STOPPED");
        entry.setVolumeMl(effectiveVolumeMl(entry, stoppedAt));
        fluidRepository.save(entry);
        return toMap(entry);
    }

    @Transactional
    public void delete(UUID entryId) {
        fluidRepository.deleteById(entryId);
    }

    public static BigDecimal effectiveVolumeMl(HubFluidEntryEntity e) {
        return effectiveVolumeMl(e, Instant.now());
    }

    public static BigDecimal effectiveVolumeMl(HubFluidEntryEntity e, Instant asOf) {
        if (e == null) return BigDecimal.ZERO;
        if (!"RUNNING".equalsIgnoreCase(e.getIntakeMode())) {
            return e.getVolumeMl() != null ? e.getVolumeMl() : BigDecimal.ZERO;
        }
        if ("STOPPED".equalsIgnoreCase(e.getRunningStatus()) && e.getVolumeMl() != null) {
            return e.getVolumeMl();
        }
        if (e.getRateMlPerHr() == null || e.getStartedAt() == null) {
            return e.getVolumeMl() != null ? e.getVolumeMl() : BigDecimal.ZERO;
        }
        Instant end = "STOPPED".equalsIgnoreCase(e.getRunningStatus()) && e.getStoppedAt() != null
                ? e.getStoppedAt() : asOf;
        long minutes = ChronoUnit.MINUTES.between(e.getStartedAt(), end);
        if (minutes < 0) minutes = 0;
        BigDecimal mlPerMinute = e.getRateMlPerHr()
                .divide(BigDecimal.valueOf(60), 6, RoundingMode.HALF_UP);
        return mlPerMinute.multiply(BigDecimal.valueOf(minutes))
                .setScale(2, RoundingMode.HALF_UP);
    }

    private HubPatientVisitEntity requireVisit(UUID visitId) {
        return visitRepository.findById(visitId)
                .orElseThrow(() -> new IllegalArgumentException("Visit not found"));
    }

    private Map<String, Object> toMap(HubFluidEntryEntity e) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("entryId", e.getId().toString());
        m.put("visitId", e.getVisitId().toString());
        m.put("entryType", e.getEntryType());
        m.put("category", e.getCategory());
        m.put("fluidName", e.getFluidName());
        m.put("volumeMl", effectiveVolumeMl(e));
        m.put("unit", e.getUnit());
        m.put("recordedAt", e.getRecordedAt().toString());
        m.put("bedLabel", e.getBedLabel());
        m.put("notes", e.getNotes());
        m.put("recordedBy", e.getRecordedBy());
        m.put("intakeMode", e.getIntakeMode());
        m.put("rateMlPerHr", e.getRateMlPerHr());
        if (e.getStartedAt() != null) m.put("startedAt", e.getStartedAt().toString());
        if (e.getStoppedAt() != null) m.put("stoppedAt", e.getStoppedAt().toString());
        m.put("runningStatus", e.getRunningStatus());
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
            return null;
        }
    }
}
