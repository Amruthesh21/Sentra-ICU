package com.sentraicu.alarmengine.hub.service;

import com.sentraicu.alarmengine.hub.entity.HubBedEntity;
import com.sentraicu.alarmengine.hub.entity.HubUnitEntity;
import com.sentraicu.alarmengine.hub.repo.HubBedAssignmentRepository;
import com.sentraicu.alarmengine.hub.repo.HubBedRepository;
import com.sentraicu.alarmengine.hub.repo.HubUnitRepository;
import com.sentraicu.alarmengine.service.CenterAdminService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class HubUnitAdminService {

    private static final String DEFAULT_CENTER = "RTWO";

    private final HubUnitRepository unitRepository;
    private final HubBedRepository bedRepository;
    private final HubBedAssignmentRepository assignmentRepository;
    private final CenterAdminService centerAdminService;

    public HubUnitAdminService(HubUnitRepository unitRepository,
                               HubBedRepository bedRepository,
                               HubBedAssignmentRepository assignmentRepository,
                               CenterAdminService centerAdminService) {
        this.unitRepository = unitRepository;
        this.bedRepository = bedRepository;
        this.assignmentRepository = assignmentRepository;
        this.centerAdminService = centerAdminService;
    }

    public List<Map<String, Object>> listUnits(String centerId) {
        return unitRepository.findByCenterIdOrderByNameAsc(resolveCenter(centerId)).stream()
                .map(u -> toUnitSummary(u, resolveCenter(centerId)))
                .toList();
    }

    public Map<String, Object> getUnitDetail(UUID unitId, String centerId) {
        String resolved = resolveCenter(centerId);
        HubUnitEntity unit = unitRepository.findById(unitId)
                .orElseThrow(() -> new IllegalArgumentException("Unit not found"));
        if (!resolved.equals(unit.getCenterId())) {
            throw new IllegalArgumentException("Unit not found");
        }
        Map<String, Object> detail = toUnitSummary(unit, resolved);
        detail.put("beds", listBedsForUnit(unitId, resolved));
        return detail;
    }

    @Transactional
    public Map<String, Object> createUnit(Map<String, Object> request, String centerId) {
        String resolved = resolveCenter(centerId);
        String code = stringVal(request.get("code"), null);
        String name = stringVal(request.get("name"), null);
        if (code == null || name == null) {
            throw new IllegalArgumentException("code and name are required");
        }
        code = code.trim().toUpperCase();
        if (unitRepository.existsByCenterIdAndCode(resolved, code)) {
            throw new IllegalArgumentException("Unit code already exists: " + code);
        }

        HubUnitEntity unit = new HubUnitEntity();
        unit.setCenterId(resolved);
        unit.setCode(code);
        unit.setName(name.trim());
        unit.setBlockName(stringVal(request.get("blockName"), null));
        unitRepository.save(unit);

        Map<String, Object> result = toUnitSummary(unit, resolved);
        result.put("status", "created");
        result.put("message", "ICU unit created — add beds under this unit in Admin.");
        return result;
    }

    @Transactional
    public Map<String, Object> addBedToUnit(UUID unitId, Map<String, Object> request, String centerId) {
        String resolved = resolveCenter(centerId);
        HubUnitEntity unit = unitRepository.findById(unitId)
                .orElseThrow(() -> new IllegalArgumentException("Unit not found"));
        if (!resolved.equals(unit.getCenterId())) {
            throw new IllegalArgumentException("Unit not found");
        }

        String bedLabel = stringVal(request.get("bedLabel"), null);
        if (bedLabel == null) {
            throw new IllegalArgumentException("bedLabel is required");
        }
        bedLabel = bedLabel.trim().toUpperCase();
        String ip = stringVal(request.get("ip"), "auto");

        if (bedRepository.findByCenterIdAndBedLabel(resolved, bedLabel).isPresent()) {
            throw new IllegalArgumentException("Bed already exists: " + bedLabel);
        }

        Map<String, Object> mongoResult = centerAdminService.addBed(bedLabel, ip, resolved);

        HubBedEntity bed = new HubBedEntity();
        bed.setCenterId(resolved);
        bed.setUnitId(unit.getId());
        bed.setBedLabel(bedLabel);
        bed.setMongoBedId(stringVal(mongoResult.get("bedId"), null));
        bed.setDeviceIp(stringVal(mongoResult.get("ip"), null));
        bed.setSimulationMode(Boolean.TRUE.equals(mongoResult.get("simulatorConnected")) ? "live" : null);
        bed.setActive(true);
        bedRepository.save(bed);

        Map<String, Object> result = new LinkedHashMap<>(mongoResult);
        result.put("unitId", unit.getId().toString());
        result.put("unitCode", unit.getCode());
        result.put("unitName", unit.getName());
        result.put("bedId", bed.getId().toString());
        result.put("message", "Bed " + bedLabel + " added to " + unit.getName() + " — Mongo/Connect Engine synced.");
        return result;
    }

    public List<Map<String, Object>> listBedsForUnit(UUID unitId, String centerId) {
        String resolved = resolveCenter(centerId);
        unitRepository.findById(unitId).orElseThrow(() -> new IllegalArgumentException("Unit not found"));
        return bedRepository.findByCenterIdAndUnitIdAndActiveTrueOrderByBedLabel(resolved, unitId).stream()
                .map(b -> toBedDetail(b, unitId))
                .toList();
    }

    private String resolveCenter(String centerId) {
        if (centerId == null || centerId.isBlank()) return DEFAULT_CENTER;
        return centerId.trim().toUpperCase(Locale.ROOT);
    }

    private Map<String, Object> toUnitSummary(HubUnitEntity unit, String centerId) {
        long bedCount = bedRepository.countByUnitIdAndActiveTrue(unit.getId());
        long occupied = bedRepository.findByCenterIdAndUnitIdAndActiveTrueOrderByBedLabel(centerId, unit.getId())
                .stream()
                .filter(b -> assignmentRepository.findByBedIdAndActiveTrue(b.getId()).isPresent())
                .count();

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("unitId", unit.getId().toString());
        m.put("code", unit.getCode());
        m.put("name", unit.getName());
        m.put("blockName", unit.getBlockName());
        m.put("centerId", unit.getCenterId());
        m.put("displayLabel", buildDisplayLabel(unit));
        m.put("bedCount", bedCount);
        m.put("occupiedCount", occupied);
        m.put("vacantCount", Math.max(bedCount - occupied, 0));
        return m;
    }

    private Map<String, Object> toBedDetail(HubBedEntity bed, UUID unitId) {
        HubUnitEntity unit = unitRepository.findById(unitId).orElse(null);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("bedId", bed.getId().toString());
        m.put("bedLabel", bed.getBedLabel());
        m.put("deviceIp", bed.getDeviceIp());
        m.put("unitId", bed.getUnitId() != null ? bed.getUnitId().toString() : null);
        m.put("unitCode", unit != null ? unit.getCode() : null);
        m.put("unitName", unit != null ? unit.getName() : null);
        m.put("occupied", assignmentRepository.findByBedIdAndActiveTrue(bed.getId()).isPresent());
        m.put("simulationMode", bed.getSimulationMode());
        return m;
    }

    public static String buildDisplayLabel(HubUnitEntity unit) {
        if (unit.getBlockName() != null && !unit.getBlockName().isBlank()) {
            return unit.getBlockName() + " · " + unit.getName();
        }
        return unit.getName() + " (" + unit.getCode() + ")";
    }

    private String stringVal(Object value, String fallback) {
        if (value == null || value.toString().isBlank()) return fallback;
        return value.toString().trim();
    }
}
