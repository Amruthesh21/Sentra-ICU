package com.rtwo.alarmengine.service;

import com.rtwo.alarmengine.hub.entity.HubBedEntity;
import com.rtwo.alarmengine.hub.repo.*;
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
    private final ConnectEngineClient connectEngineClient;
    private final DeviceCatalogService deviceCatalogService;
    private final ConnectEngineSyncService connectEngineSyncService;
    private final HubBedRepository hubBedRepository;
    private final HubBedAssignmentRepository hubAssignmentRepository;
    private final HubPatientVisitRepository hubVisitRepository;
    private final HubPatientRepository hubPatientRepository;

    public CenterAdminService(MongoTemplate mongoTemplate,
                              ConnectEngineClient connectEngineClient,
                              DeviceCatalogService deviceCatalogService,
                              ConnectEngineSyncService connectEngineSyncService,
                              HubBedRepository hubBedRepository,
                              HubBedAssignmentRepository hubAssignmentRepository,
                              HubPatientVisitRepository hubVisitRepository,
                              HubPatientRepository hubPatientRepository) {
        this.mongoTemplate = mongoTemplate;
        this.connectEngineClient = connectEngineClient;
        this.deviceCatalogService = deviceCatalogService;
        this.connectEngineSyncService = connectEngineSyncService;
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
        Map<String, Object> live = connectEngineClient.retrieve();
        Map<String, String> display = resolveCenterDisplay(cid, mongoCenter, live);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("centerId", cid);
        response.put("centerName", display.get("centerName"));
        response.put("centerLocation", display.get("centerLocation"));
        response.put("beds", mapBeds(cid, mongoCenter, live));
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

        Document newBed = new Document();
        newBed.put("_id", UUID.randomUUID().toString());
        newBed.put("bedLabel", bedLabel);
        newBed.put("ip", encryptIp(resolvedIp));
        newBed.put("_class", "com.rtwo.med.device.connect.mongo.dal.entities.BedEntity");
        if (simIp && !simIpTaken) {
            newBed.put("devices", deviceCatalogService.defaultDevicesForSimulatorBed());
            newBed.put("simulationMode", "live");
        } else {
            newBed.put("simulationMode", "virtual");
        }
        beds.add(newBed);

        saveBeds(cid, beds, center);
        syncConnectEngine(cid, beds, center);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("bedLabel", bedLabel);
        result.put("bedId", newBed.getString("_id"));
        result.put("ip", resolvedIp);
        result.put("status", "created");
        result.put("connectEngineSynced", true);
        result.put("simulatorConnected", simIp && !simIpTaken);
        result.put("liveVitalsCapable", simIp && !simIpTaken);
        result.put("virtualSimulatorActive", !simIp || simIpTaken);
        if (simIpTaken) {
            result.put("message", "Bed created with virtual simulation — unique vitals per bed. Physical simulator is on another bed.");
        } else if (simIp) {
            result.put("message", "Bed created with live simulator. Admit a patient to start live vitals.");
        } else {
            result.put("message", "Bed created with virtual simulation — admit a patient for unique simulated vitals.");
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
                    if (bed.get("devices") == null) {
                        bed.put("devices", deviceCatalogService.defaultDevicesForSimulatorBed());
                    }
                } else {
                    bed.put("simulationMode", "virtual");
                }
                found = true;
                break;
            }
        }
        if (!found) {
            throw new IllegalArgumentException("Bed not found: " + bedLabel);
        }

        saveBeds(cid, beds, center);
        syncConnectEngine(cid, beds, center);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("bedLabel", bedLabel);
        result.put("ip", ip.trim());
        result.put("status", "updated");
        result.put("connectEngineSynced", true);
        result.put("message", "Bed IP updated — Hub synced instantly.");
        return result;
    }

    public Map<String, Object> reloadConnectEngine() {
        boolean restarted = connectEngineSyncService.forceRestart();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("connectEngineSynced", restarted);
        result.put("message", restarted
                ? "Connect Engine restarted — device gateway synced."
                : "Connect Engine restart skipped (docker socket unavailable). Hub uses MongoDB.");
        return result;
    }

    private String resolveCenterId(String centerId) {
        if (centerId == null || centerId.isBlank()) return DEFAULT_CENTER;
        return centerId.trim().toUpperCase(Locale.ROOT);
    }

    /** Prefer Connect Engine / Mongo display names over Postgres hospital labels. */
    private Map<String, String> resolveCenterDisplay(String centerId, Document mongoCenter, Map<String, Object> live) {
        String name = null;
        String location = null;

        if (live != null && !live.isEmpty()) {
            name = stringVal(live.get("name"), stringVal(live.get("centerName"), null));
            location = stringVal(live.get("location"), stringVal(live.get("centerLocation"), null));
        }
        if (mongoCenter != null) {
            if (name == null) name = mongoCenter.getString("centerName");
            if (location == null) location = mongoCenter.getString("centerLocation");
        }
        if (name == null || name.isBlank()) name = centerId;
        if (location == null) location = DEFAULT_CENTER.equals(centerId) ? DEFAULT_LOCATION : "";

        Map<String, String> out = new LinkedHashMap<>();
        out.put("centerName", name);
        out.put("centerLocation", location);
        return out;
    }

    private String resolveBedIp(String requestedIp, List<Document> beds, String excludeBedLabel) {
        if (requestedIp != null && !requestedIp.isBlank() && !"auto".equalsIgnoreCase(requestedIp.trim())) {
            String ip = requestedIp.trim();
            if (DeviceCatalogService.SIMULATOR_IP.equals(ip)
                    && isSimulatorIpInUse(ip, beds, excludeBedLabel)) {
                return nextAvailableIp(beds);
            }
            return ip;
        }
        if (!isSimulatorIpInUse(DeviceCatalogService.SIMULATOR_IP, beds, excludeBedLabel)) {
            return DeviceCatalogService.SIMULATOR_IP;
        }
        return nextAvailableIp(beds);
    }

    private static final Set<Integer> RESERVED_DOCKER_OCTETS = Set.of(10, 11, 12, 13, 14, 15);

    private String nextAvailableIp(List<Document> beds) {
        for (int i = 9; i <= 254; i++) {
            if (RESERVED_DOCKER_OCTETS.contains(i)) continue;
            String candidate = "172.25.0." + i;
            if (!isSimulatorIpInUse(candidate, beds, null)) return candidate;
        }
        return "172.25.0.254";
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

        Map<String, Object> live = connectEngineClient.retrieve();
        Map<String, String> display = resolveCenterDisplay(cid, null, live);

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
        Map<String, String> display = resolveCenterDisplay(cid, center, connectEngineClient.retrieve());
        mongoTemplate.updateFirst(
                new Query(Criteria.where("_id").is(cid)),
                new Update()
                        .set("beds", beds)
                        .set("centerName", display.get("centerName"))
                        .set("centerLocation", display.get("centerLocation")),
                "centerEntity"
        );
    }

    private boolean syncConnectEngine(String centerId, List<Document> beds, Document center) {
        String cid = resolveCenterId(centerId);
        Map<String, String> display = resolveCenterDisplay(cid, center, connectEngineClient.retrieve());
        List<Map<String, Object>> payloadBeds = new ArrayList<>();
        for (Document bed : beds) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("bedLabel", bed.getString("bedLabel"));
            entry.put("ip", decryptIp(bed.getString("ip")));
            payloadBeds.add(entry);
        }
        return connectEngineClient.pushCenterUpdate(
                display.get("centerName"), display.get("centerLocation"), payloadBeds);
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> mapBeds(String centerId, Document center, Map<String, Object> live) {
        String cid = resolveCenterId(centerId);
        List<Map<String, Object>> result = new ArrayList<>();
        Map<String, Map<String, Object>> liveByLabel = new LinkedHashMap<>();

        Object liveBeds = live.get("beds");
        if (liveBeds instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> map) {
                    String label = String.valueOf(map.get("bedLabel"));
                    liveByLabel.put(label, (Map<String, Object>) map);
                }
            }
        }

        List<Document> mongoBeds = center != null ? getBedList(center) : List.of();
        Map<String, Document> mongoByLabel = mongoBeds.stream()
                .collect(Collectors.toMap(b -> b.getString("bedLabel"), b -> b, (a, b) -> a));

        Set<String> labels = new LinkedHashSet<>();
        labels.addAll(mongoByLabel.keySet());
        labels.addAll(liveByLabel.keySet());
        hubBedRepository.findByCenterIdAndActiveTrueOrderByBedLabel(cid).stream()
                .map(HubBedEntity::getBedLabel)
                .forEach(labels::add);

        if (labels.isEmpty() && !liveByLabel.isEmpty()) {
            labels.addAll(liveByLabel.keySet());
        }

        for (String label : labels) {
            result.add(mapBedEntry(cid, label, liveByLabel.get(label), mongoByLabel.get(label),
                    mongoBeds.isEmpty() ? List.of() : mongoBeds));
        }
        return result;
    }

    private Map<String, Object> mapBedEntry(
            String centerId,
            String label,
            Map<String, Object> liveBed,
            Document mongoBed,
            List<Document> allBeds) {
        Map<String, Object> bed = new LinkedHashMap<>();
        bed.put("bedLabel", label);
        bed.put("bedId", mongoBed != null ? mongoBed.get("_id") : liveBed != null ? liveBed.get("bedId") : null);
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
            boolean virtualSim = "virtual".equals(mongoBed.getString("simulationMode"))
                    || (!liveSim && postgresPatient != null);
            bed.put("deviceIp", ip);
            bed.put("simulatorConnected", liveSim);
            bed.put("liveVitalsCapable", liveSim);
            bed.put("virtualSimulatorActive", virtualSim);
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
                                            patient.put("weight", p.getBirthWeightKg());
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
