package com.sentraicu.alarmengine.service;

import com.sentraicu.alarmengine.hub.HubCenterIds;
import com.sentraicu.alarmengine.hub.entity.HubBedEntity;
import com.sentraicu.alarmengine.hub.repo.*;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class CenterAdminService {

    private static final String DEFAULT_CENTER = "RTWO";
    private static final String DEFAULT_LOCATION = "JPN";

    private final MongoTemplate mongoTemplate;
    private final HubBedRepository hubBedRepository;
    private final HubBedAssignmentRepository hubAssignmentRepository;
    private final HubPatientVisitRepository hubVisitRepository;
    private final HubPatientRepository hubPatientRepository;

    public CenterAdminService(MongoTemplate mongoTemplate,
                              HubBedRepository hubBedRepository,
                              HubBedAssignmentRepository hubAssignmentRepository,
                              HubPatientVisitRepository hubVisitRepository,
                              HubPatientRepository hubPatientRepository) {
        this.mongoTemplate = mongoTemplate;
        this.hubBedRepository = hubBedRepository;
        this.hubAssignmentRepository = hubAssignmentRepository;
        this.hubVisitRepository = hubVisitRepository;
        this.hubPatientRepository = hubPatientRepository;
    }

    public Map<String, Object> getCenterOverview() {
        return getCenterOverview(DEFAULT_CENTER);
    }

    public Map<String, Object> getCenterOverview(String centerId) {
        String cid = resolveCenterId(centerId);
        Document mongoCenter = mongoTemplate.findOne(
                new Query(Criteria.where("_id").is(cid)), Document.class, "centerEntity");
        Map<String, String> display = resolveCenterDisplay(cid, mongoCenter);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("centerId", cid);
        response.put("centerName", display.get("centerName"));
        response.put("centerLocation", display.get("centerLocation"));
        response.put("beds", mapBeds(cid, mongoCenter));
        response.put("source", mongoCenter != null ? "mongodb+connect" : "postgres");
        return response;
    }

    public Map<String, Object> addBed(String bedLabel, String ip) {
        return addBed(bedLabel, ip, DEFAULT_CENTER);
    }

    public Map<String, Object> addBed(String bedLabel, String ip, String centerId) {
        String cid = resolveCenterId(centerId);
        if (bedLabel == null || bedLabel.isBlank()) {
            throw new IllegalArgumentException("bedLabel is required");
        }

        Document center = ensureCenter(cid);
        List<Document> beds = getBedList(center);

        for (Document bed : beds) {
            if (bedLabel.equals(bed.getString("bedLabel"))) {
                throw new IllegalArgumentException("Bed already exists: " + bedLabel);
            }
        }

        String resolvedIp = resolveBedIp(ip, beds, null);
        boolean simIp = DeviceCatalogService.SIMULATOR_IP.equals(resolvedIp);
        boolean simIpTaken = simIp && isSimulatorIpInUse(resolvedIp, beds, null);
        boolean live = simIp && !simIpTaken;

        Document newBed = new Document();
        newBed.put("_id", UUID.randomUUID().toString());
        newBed.put("bedLabel", bedLabel);
        newBed.put("ip", encryptIp(resolvedIp));
        newBed.put("_class", "com.rtwo.med.device.connect.mongo.dal.entities.BedEntity");
        if (live) {
            // Used to also invent a devices list here
            // (deviceCatalogService.defaultDevicesForSimulatorBed(), the
            // pre-rebrand ["BplUltimaPrime","Agilia","BplElisa600"] catalog)
            // — leave it unset instead; nothing about creating a bed with
            // this IP tells us what's actually connected.
            newBed.put("simulationMode", "live");
        }
        beds.add(newBed);

        saveBeds(cid, beds, center);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("bedLabel", bedLabel);
        result.put("bedId", newBed.getString("_id"));
        result.put("ip", resolvedIp);
        result.put("status", "created");
        result.put("simulatorConnected", live);
        result.put("liveVitalsCapable", live);
        if (live) {
            result.put("message", "Bed created with live simulator. Admit a patient to start live vitals.");
        } else if (resolvedIp != null) {
            result.put("message", "Bed created with device IP " + resolvedIp + ".");
        } else {
            result.put("message", "Bed created — not connected to a device yet. Use \"Connect a device\" once one sends data.");
        }
        return result;
    }

    public Map<String, Object> updateBedIp(String bedLabel, String ip) {
        return updateBedIp(bedLabel, ip, DEFAULT_CENTER);
    }

    public Map<String, Object> updateBedIp(String bedLabel, String ip, String centerId) {
        String cid = resolveCenterId(centerId);
        if (ip == null || ip.isBlank()) {
            throw new IllegalArgumentException("ip is required");
        }

        Document center = ensureCenter(cid);
        List<Document> beds = getBedList(center);
        boolean found = false;

        for (Document bed : beds) {
            if (bedLabel.equals(bed.getString("bedLabel"))) {
                String resolvedIp = ip.trim();
                if (DeviceCatalogService.SIMULATOR_IP.equals(resolvedIp)
                        && isSimulatorIpInUse(resolvedIp, beds, bedLabel)) {
                    throw new IllegalArgumentException("Simulator IP 172.25.0.8 is already assigned to another bed");
                }
                bed.put("ip", encryptIp(resolvedIp));
                if (DeviceCatalogService.SIMULATOR_IP.equals(resolvedIp)) {
                    bed.put("simulationMode", "live");
                    // Used to also backfill a fake devices list here if one
                    // wasn't already set — same reasoning as addBed() above.
                } else {
                    bed.remove("simulationMode");
                }
                found = true;
                break;
            }
        }
        if (!found) {
            throw new IllegalArgumentException("Bed not found: " + bedLabel);
        }

        saveBeds(cid, beds, center);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("bedLabel", bedLabel);
        result.put("ip", ip.trim());
        result.put("status", "updated");
        result.put("message", "Bed IP updated — Hub synced instantly.");
        return result;
    }

    private String resolveCenterId(String centerId) {
        if (centerId == null || centerId.isBlank()) return DEFAULT_CENTER;
        return centerId.trim().toUpperCase(Locale.ROOT);
    }

    /** Prefer Mongo's stored display name over Postgres hospital labels. */
    private Map<String, String> resolveCenterDisplay(String centerId, Document mongoCenter) {
        String name = null;
        String location = null;

        if (mongoCenter != null) {
            name = mongoCenter.getString("centerName");
            location = mongoCenter.getString("centerLocation");
        }
        if (name == null || name.isBlank()) name = centerId;
        if (location == null) location = DEFAULT_CENTER.equals(centerId) ? DEFAULT_LOCATION : "";

        Map<String, String> out = new LinkedHashMap<>();
        out.put("centerName", name);
        out.put("centerLocation", location);
        brandCenterDisplay(centerId, out);
        return out;
    }

    /** Technical center id stays RTWO for Connect Engine sync; brand as Sentra ICU in APIs/UI. */
    private void brandCenterDisplay(String centerId, Map<String, String> display) {
        String name = display.get("centerName");
        boolean isOpsCenter = DEFAULT_CENTER.equalsIgnoreCase(centerId);
        boolean nameHasRtwo = name != null && name.toUpperCase(Locale.ROOT).contains("RTWO");
        if (isOpsCenter || nameHasRtwo) {
            display.put("centerName", HubCenterIds.BRAND_DISPLAY);
        }
    }

    /**
     * A new bed starts with NO device IP unless one is explicitly given —
     * it used to silently auto-assign the shared device-simulator's IP (or
     * the next one in a fake 172.25.0.x range) to every bed on creation,
     * which made brand-new, nothing-plugged-in beds show as "LIVE CE" /
     * connected. Real device association happens explicitly (e.g. via the
     * "Connect a device" flow), never invented here.
     */
    private String resolveBedIp(String requestedIp, List<Document> beds, String excludeBedLabel) {
        if (requestedIp == null || requestedIp.isBlank() || "auto".equalsIgnoreCase(requestedIp.trim())) {
            return null;
        }
        String ip = requestedIp.trim();
        if (isSimulatorIpInUse(ip, beds, excludeBedLabel)) {
            throw new IllegalArgumentException("Device IP " + ip + " is already assigned to another bed");
        }
        return ip;
    }

    private boolean isSimulatorIpInUse(String ip, List<Document> beds, String excludeBedLabel) {
        for (Document bed : beds) {
            if (excludeBedLabel != null && excludeBedLabel.equals(bed.getString("bedLabel"))) continue;
            if (ip.equals(decryptIp(bed.getString("ip")))) return true;
        }
        return false;
    }

    private Document ensureCenter(String centerId) {
        String cid = resolveCenterId(centerId);
        Document center = mongoTemplate.findOne(new Query(Criteria.where("_id").is(cid)), Document.class, "centerEntity");
        if (center != null) return center;

        Map<String, String> display = resolveCenterDisplay(cid, null);

        Document created = new Document();
        created.put("_id", cid);
        created.put("centerName", display.get("centerName"));
        created.put("centerLocation", display.get("centerLocation"));
        created.put("beds", new ArrayList<>());
        created.put("_class", "com.rtwo.med.device.connect.mongo.dal.entities.CenterEntity");
        mongoTemplate.save(created, "centerEntity");
        return created;
    }

    @SuppressWarnings("unchecked")
    private List<Document> getBedList(Document center) {
        Object bedsObj = center.get("beds");
        if (bedsObj instanceof List<?> list) {
            List<Document> beds = new ArrayList<>();
            for (Object item : list) {
                if (item instanceof Document doc) beds.add(doc);
                else if (item instanceof Map<?, ?> map) beds.add(new Document((Map<String, Object>) map));
            }
            return beds;
        }
        return new ArrayList<>();
    }

    private void saveBeds(String centerId, List<Document> beds, Document center) {
        String cid = resolveCenterId(centerId);
        Map<String, String> display = resolveCenterDisplay(cid, center);
        mongoTemplate.updateFirst(
                new Query(Criteria.where("_id").is(cid)),
                new Update()
                        .set("beds", beds)
                        .set("centerName", display.get("centerName"))
                        .set("centerLocation", display.get("centerLocation")),
                "centerEntity"
        );
    }

    private List<Map<String, Object>> mapBeds(String centerId, Document center) {
        String cid = resolveCenterId(centerId);
        List<Map<String, Object>> result = new ArrayList<>();

        List<Document> mongoBeds = center != null ? getBedList(center) : List.of();
        Map<String, Document> mongoByLabel = mongoBeds.stream()
                .collect(Collectors.toMap(b -> b.getString("bedLabel"), b -> b, (a, b) -> a));

        Set<String> labels = new LinkedHashSet<>();
        labels.addAll(mongoByLabel.keySet());
        hubBedRepository.findByCenterIdAndActiveTrueOrderByBedLabel(cid).stream()
                .map(HubBedEntity::getBedLabel)
                .forEach(labels::add);

        for (String label : labels) {
            result.add(mapBedEntry(cid, label, mongoByLabel.get(label),
                    mongoBeds.isEmpty() ? List.of() : mongoBeds));
        }
        return result;
    }

    private Map<String, Object> mapBedEntry(
            String centerId,
            String label,
            Document mongoBed,
            List<Document> allBeds) {
        Map<String, Object> bed = new LinkedHashMap<>();
        bed.put("bedLabel", label);
        bed.put("bedId", mongoBed != null ? mongoBed.get("_id") : null);
        bed.put("alarmBedId", "ICU-1-" + label);

        Map<String, Object> postgresPatient = resolvePostgresPatient(centerId, label);
        if (postgresPatient != null) {
            bed.put("patient", postgresPatient);
            bed.put("occupied", true);
        } else {
            bed.put("occupied", false);
        }

        if (mongoBed != null) {
            String ip = decryptIp(mongoBed.getString("ip"));
            boolean liveSim = DeviceCatalogService.SIMULATOR_IP.equals(ip);
            bed.put("deviceIp", ip);
            bed.put("simulatorConnected", liveSim);
            bed.put("liveVitalsCapable", liveSim);
            bed.put("simulationMode", mongoBed.getString("simulationMode"));
            bed.put("ipConflict", liveSim && isSimulatorIpInUse(ip, allBeds, label));
        } else {
            hubBedRepository.findByCenterIdAndBedLabel(centerId, label).ifPresent(hubBed -> {
                if (hubBed.getDeviceIp() != null) bed.put("deviceIp", hubBed.getDeviceIp());
                if (hubBed.getSimulationMode() != null) bed.put("simulationMode", hubBed.getSimulationMode());
            });
        }
        return bed;
    }

    private Map<String, Object> resolvePostgresPatient(String centerId, String bedLabel) {
        return hubBedRepository.findByCenterIdAndBedLabel(resolveCenterId(centerId), bedLabel)
                .flatMap(bed -> hubAssignmentRepository.findByBedIdAndActiveTrue(bed.getId())
                        .flatMap(a -> hubVisitRepository.findById(a.getVisitId())
                                .flatMap(v -> hubPatientRepository.findById(v.getPatientId())
                                        .map(p -> {
                                            Map<String, Object> patient = new LinkedHashMap<>();
                                            patient.put("name", p.getFullName());
                                            patient.put("mrn", p.getMrn());
                                            patient.put("puid", p.getMrn());
                                            patient.put("gender", p.getSex());
                                            patient.put("sex", p.getSex());
                                            patient.put("dateOfBirth", p.getDateOfBirth() != null ? p.getDateOfBirth().toString() : null);
                                            patient.put("weight", p.getBirthWeightKg());
                                            patient.put("diagnosis", v.getPrimaryDiagnosis() != null ? v.getPrimaryDiagnosis() : v.getProvisionalDiagnosis());
                                            patient.put("primaryDiagnosis", v.getPrimaryDiagnosis());
                                            patient.put("attendingPhysician", v.getAttendingPhysician());
                                            patient.put("primaryNurse", v.getPrimaryNurse());
                                            patient.put("id", v.getId().toString());
                                            patient.put("visitId", v.getId().toString());
                                            return patient;
                                        }))))
                .orElse(null);
    }

    private String stringVal(Object value, String fallback) {
        if (value == null || value.toString().isBlank()) return fallback;
        return value.toString().trim();
    }

    public static String encryptIp(String ip) {
        if (ip == null || ip.isBlank()) return null;
        String b64 = Base64.getEncoder().encodeToString(ip.getBytes(StandardCharsets.UTF_8));
        return new StringBuilder(b64).reverse().toString();
    }

    public static String decryptIp(String encrypted) {
        if (encrypted == null || encrypted.isBlank()) return "";
        if (encrypted.matches("\\d+\\.\\d+\\.\\d+\\.\\d+")) return encrypted;
        try {
            String reversed = new StringBuilder(encrypted).reverse().toString();
            return new String(Base64.getDecoder().decode(reversed), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return encrypted;
        }
    }
}
