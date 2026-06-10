package com.rtwo.alarmengine.service;

import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class CenterAdminService {

    private static final String DEFAULT_CENTER = "RTWO";
    private static final String DEFAULT_LOCATION = "JPN";

    private final MongoTemplate mongoTemplate;
    private final ConnectEngineClient connectEngineClient;
    private final DeviceCatalogService deviceCatalogService;
    private final ConnectEngineSyncService connectEngineSyncService;

    public CenterAdminService(MongoTemplate mongoTemplate,
                              ConnectEngineClient connectEngineClient,
                              DeviceCatalogService deviceCatalogService,
                              ConnectEngineSyncService connectEngineSyncService) {
        this.mongoTemplate = mongoTemplate;
        this.connectEngineClient = connectEngineClient;
        this.deviceCatalogService = deviceCatalogService;
        this.connectEngineSyncService = connectEngineSyncService;
    }

    public Map<String, Object> getCenterOverview() {
        Document center = mongoTemplate.findOne(new Query(Criteria.where("_id").is(DEFAULT_CENTER)), Document.class, "centerEntity");
        Map<String, Object> live = connectEngineClient.retrieve();

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("centerName", DEFAULT_CENTER);
        response.put("centerLocation", DEFAULT_LOCATION);
        response.put("beds", mapBeds(center, live));
        response.put("source", center != null ? "mongodb+connect" : "connect");
        return response;
    }

    public Map<String, Object> addBed(String bedLabel, String ip) {
        if (bedLabel == null || bedLabel.isBlank()) {
            throw new IllegalArgumentException("bedLabel is required");
        }

        Document center = ensureCenter();
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

        saveBeds(beds);
        boolean synced = syncConnectEngine(beds);

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
        if (ip == null || ip.isBlank()) {
            throw new IllegalArgumentException("ip is required");
        }

        Document center = ensureCenter();
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

        saveBeds(beds);
        boolean synced = syncConnectEngine(beds);

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

    /** Docker compose static addresses on alarampoc_docker_compose_network — skip for virtual bed IPs. */
    private static final Set<Integer> RESERVED_DOCKER_OCTETS = Set.of(10, 11, 12, 13, 14, 15);

    private String nextAvailableIp(List<Document> beds) {
        for (int i = 9; i <= 254; i++) {
            if (RESERVED_DOCKER_OCTETS.contains(i)) {
                continue;
            }
            String candidate = "172.25.0." + i;
            if (!isSimulatorIpInUse(candidate, beds, null)) {
                return candidate;
            }
        }
        return "172.25.0.254";
    }

    private boolean isSimulatorIpInUse(String ip, List<Document> beds, String excludeBedLabel) {
        for (Document bed : beds) {
            if (excludeBedLabel != null && excludeBedLabel.equals(bed.getString("bedLabel"))) {
                continue;
            }
            if (ip.equals(decryptIp(bed.getString("ip")))) {
                return true;
            }
        }
        return false;
    }

    private Document ensureCenter() {
        Document center = mongoTemplate.findOne(new Query(Criteria.where("_id").is(DEFAULT_CENTER)), Document.class, "centerEntity");
        if (center != null) {
            return center;
        }

        Document created = new Document();
        created.put("_id", DEFAULT_CENTER);
        created.put("centerName", DEFAULT_CENTER);
        created.put("centerLocation", DEFAULT_LOCATION);
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
                if (item instanceof Document doc) {
                    beds.add(doc);
                } else if (item instanceof Map<?, ?> map) {
                    beds.add(new Document((Map<String, Object>) map));
                }
            }
            return beds;
        }
        return new ArrayList<>();
    }

    private void saveBeds(List<Document> beds) {
        mongoTemplate.updateFirst(
                new Query(Criteria.where("_id").is(DEFAULT_CENTER)),
                new Update().set("beds", beds).set("centerName", DEFAULT_CENTER).set("centerLocation", DEFAULT_LOCATION),
                "centerEntity"
        );
    }

    private boolean syncConnectEngine(List<Document> beds) {
        List<Map<String, Object>> payloadBeds = new ArrayList<>();
        for (Document bed : beds) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("bedLabel", bed.getString("bedLabel"));
            entry.put("ip", decryptIp(bed.getString("ip")));
            payloadBeds.add(entry);
        }
        return connectEngineClient.pushCenterUpdate(DEFAULT_CENTER, DEFAULT_LOCATION, payloadBeds);
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> mapBeds(Document center, Map<String, Object> live) {
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
        if (mongoBeds.isEmpty() && !liveByLabel.isEmpty()) {
            for (Map.Entry<String, Map<String, Object>> entry : liveByLabel.entrySet()) {
                result.add(mapBedEntry(entry.getKey(), entry.getValue(), null, List.of()));
            }
            return result;
        }

        for (Document bed : mongoBeds) {
            String label = bed.getString("bedLabel");
            result.add(mapBedEntry(label, liveByLabel.get(label), bed, mongoBeds));
        }
        return result;
    }

    private Map<String, Object> mapBedEntry(String label, Map<String, Object> liveBed, Document mongoBed, List<Document> allBeds) {
        Map<String, Object> bed = new LinkedHashMap<>();
        bed.put("bedLabel", label);
        bed.put("bedId", mongoBed != null ? mongoBed.get("_id") : liveBed != null ? liveBed.get("bedId") : null);
        bed.put("alarmBedId", "ICU-1-" + label);
        Object patient = mongoBed != null ? mongoBed.get("patient") : null;
        if (patient == null && liveBed != null) {
            patient = liveBed.get("patient");
        }

        if (mongoBed != null) {
            String ip = decryptIp(mongoBed.getString("ip"));
            boolean liveSim = DeviceCatalogService.SIMULATOR_IP.equals(ip);
            boolean virtualSim = "virtual".equals(mongoBed.getString("simulationMode"))
                    || (!liveSim && patient != null);
            bed.put("deviceIp", ip);
            bed.put("simulatorConnected", liveSim);
            bed.put("liveVitalsCapable", liveSim);
            bed.put("virtualSimulatorActive", virtualSim);
            bed.put("simulationMode", mongoBed.getString("simulationMode"));
            bed.put("ipConflict", liveSim && isSimulatorIpInUse(ip, allBeds, label));
        }
        if (patient instanceof Map<?, ?> patientMap) {
            Map<String, Object> p = new LinkedHashMap<>();
            p.put("name", patientMap.get("name"));
            p.put("mrn", firstNonNull(patientMap.get("puid"), patientMap.get("mrn")));
            p.put("gender", patientMap.get("gender"));
            p.put("weight", patientMap.get("weight"));
            p.put("visitId", patientMap.get("id"));
            bed.put("patient", p);
            bed.put("occupied", true);
        } else {
            bed.put("occupied", false);
        }
        return bed;
    }

    private Object firstNonNull(Object a, Object b) {
        return a != null ? a : b;
    }

    static String encryptIp(String ip) {
        String b64 = Base64.getEncoder().encodeToString(ip.getBytes(StandardCharsets.UTF_8));
        return new StringBuilder(b64).reverse().toString();
    }

    static String decryptIp(String encrypted) {
        if (encrypted == null || encrypted.isBlank()) {
            return "";
        }
        if (encrypted.matches("\\d+\\.\\d+\\.\\d+\\.\\d+")) {
            return encrypted;
        }
        try {
            String reversed = new StringBuilder(encrypted).reverse().toString();
            return new String(Base64.getDecoder().decode(reversed), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return encrypted;
        }
    }
}
