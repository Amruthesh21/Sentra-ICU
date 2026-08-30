package com.sentraicu.alarmengine.service;

import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class PatientAdminService {

    private static final String DEFAULT_CENTER = "RTWO";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final MongoTemplate mongoTemplate;
    private final ConnectEngineClient connectEngineClient;
    private final DeviceCatalogService deviceCatalogService;

    public PatientAdminService(MongoTemplate mongoTemplate,
                               ConnectEngineClient connectEngineClient,
                               DeviceCatalogService deviceCatalogService) {
        this.mongoTemplate = mongoTemplate;
        this.connectEngineClient = connectEngineClient;
        this.deviceCatalogService = deviceCatalogService;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> admitPatient(String bedLabel, Map<String, Object> request) {
        String name = stringVal(request.get("name"));
        String mrn = stringVal(request.get("mrn"));
        String gender = stringVal(request.get("gender"));
        Double weight = doubleVal(request.get("weight"));
        LocalDate dob = parseDate(request.get("dateOfBirth"));
        List<String> deviceIds = parseDeviceIds(request.get("devices"));

        if (name == null || mrn == null || gender == null) {
            throw new IllegalArgumentException("name, mrn, and gender are required");
        }

        Document center = mongoTemplate.findOne(new Query(Criteria.where("_id").is(DEFAULT_CENTER)), Document.class, "centerEntity");
        if (center == null) {
            throw new IllegalStateException("Center not configured — add a bed first");
        }

        List<Document> beds = getBedList(center);
        Document targetBed = null;
        for (Document bed : beds) {
            if (bedLabel.equals(bed.getString("bedLabel"))) {
                targetBed = bed;
                break;
            }
        }
        if (targetBed == null) {
            throw new IllegalArgumentException("Bed not found: " + bedLabel);
        }

        String bedIp = CenterAdminService.decryptIp(targetBed.getString("ip"));
        boolean simBed = DeviceCatalogService.SIMULATOR_IP.equals(bedIp);

        if (deviceIds.isEmpty()) {
            deviceIds = deviceCatalogService.defaultDevicesForSimulatorBed();
        }

        if (!simBed) {
            targetBed.put("simulationMode", "virtual");
        } else {
            targetBed.put("simulationMode", "live");
        }

        String visitId = new ObjectId().toHexString();
        String upid = generateUpid();
        Instant now = Instant.now();

        Document visit = new Document();
        visit.put("visitID", visitId);
        visit.put("mrn", mrn);
        visit.put("admissionDate", Date.from(now));
        visit.put("severity", List.of(new Document("time", Date.from(now)).append("value", "I")));
        visit.put("gestation", 1);

        Document patientEntity = new Document();
        patientEntity.put("_id", upid);
        patientEntity.put("name", name);
        patientEntity.put("gender", gender.charAt(0));
        if (dob != null) {
            patientEntity.put("dob", Date.from(dob.atStartOfDay(ZoneId.systemDefault()).toInstant()));
        }
        if (weight != null) {
            patientEntity.put("birthWeight", weight);
        }
        patientEntity.put("patientVisit", List.of(visit));
        patientEntity.put("currentVisitId", visitId);
        patientEntity.put("_class", "com.rtwo.med.device.connect.mongo.dal.entities.PatientInfoEntity");
        mongoTemplate.save(patientEntity, "patientInfoEntity");

        Document bedPatient = new Document();
        bedPatient.put("_id", new ObjectId(visitId));
        bedPatient.put("name", name);
        bedPatient.put("mrn", upid);
        bedPatient.put("puid", mrn);
        bedPatient.put("gender", gender);
        if (weight != null) {
            bedPatient.put("weight", weight);
        }
        if (dob != null) {
            bedPatient.put("dateOfBirth", Date.from(dob.atStartOfDay(ZoneId.systemDefault()).toInstant()));
        }
        bedPatient.put("createdDtTm", Date.from(now));
        bedPatient.put("severity", "I");
        bedPatient.put("gestation", 1);

        targetBed.put("patient", bedPatient);
        if (!deviceIds.isEmpty()) {
            targetBed.put("devices", deviceIds);
        }

        mongoTemplate.updateFirst(
                new Query(Criteria.where("_id").is(DEFAULT_CENTER)),
                new Update().set("beds", beds),
                "centerEntity"
        );

        boolean synced = syncConnectEngine(beds);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("bedLabel", bedLabel);
        result.put("patientName", name);
        result.put("patientMRN", mrn);
        result.put("visitId", visitId);
        result.put("devices", deviceIds);
        result.put("simulatorConnected", simBed);
        result.put("connectEngineSynced", synced);
        result.put("status", "admitted");
        result.put("message", simBed
                ? "Patient admitted — Hub updated. Live vitals on simulator bed " + bedLabel + "."
                : "Patient admitted — Hub updated for " + bedLabel + ". Connect a device to start live vitals.");
        return result;
    }

    public Map<String, Object> dischargePatient(String bedLabel) {
        Document center = mongoTemplate.findOne(new Query(Criteria.where("_id").is(DEFAULT_CENTER)), Document.class, "centerEntity");
        if (center == null) {
            throw new IllegalArgumentException("Center not found");
        }

        List<Document> beds = getBedList(center);
        boolean found = false;
        for (Document bed : beds) {
            if (bedLabel.equals(bed.getString("bedLabel"))) {
                bed.remove("patient");
                found = true;
                break;
            }
        }
        if (!found) {
            throw new IllegalArgumentException("Bed not found: " + bedLabel);
        }

        mongoTemplate.updateFirst(
                new Query(Criteria.where("_id").is(DEFAULT_CENTER)),
                new Update().set("beds", beds),
                "centerEntity"
        );
        syncConnectEngine(beds);

        return Map.of("bedLabel", bedLabel, "status", "discharged", "connectEngineSynced", true,
                "message", "Patient discharged — Hub updated instantly.");
    }

    @SuppressWarnings("unchecked")
    private List<String> parseDeviceIds(Object devicesObj) {
        List<String> ids = new ArrayList<>();
        if (devicesObj instanceof List<?> list) {
            for (Object item : list) {
                if (item != null && !item.toString().isBlank()) {
                    ids.add(item.toString());
                }
            }
        }
        return ids;
    }

    @SuppressWarnings("unchecked")
    private List<Document> getBedList(Document center) {
        Object bedsObj = center.get("beds");
        List<Document> beds = new ArrayList<>();
        if (bedsObj instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Document doc) {
                    beds.add(doc);
                } else if (item instanceof Map<?, ?> map) {
                    beds.add(new Document((Map<String, Object>) map));
                }
            }
        }
        return beds;
    }

    private boolean syncConnectEngine(List<Document> beds) {
        List<Map<String, Object>> payloadBeds = new ArrayList<>();
        for (Document bed : beds) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("bedLabel", bed.getString("bedLabel"));
            entry.put("ip", CenterAdminService.decryptIp(bed.getString("ip")));
            payloadBeds.add(entry);
        }
        return connectEngineClient.pushCenterUpdate(DEFAULT_CENTER, "JPN", payloadBeds,
                ConnectEngineSyncService.SyncTrigger.PATIENT_ASSIGNMENT);
    }

    private String generateUpid() {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        StringBuilder sb = new StringBuilder(12);
        for (int i = 0; i < 12; i++) {
            sb.append(chars.charAt(RANDOM.nextInt(chars.length())));
        }
        return sb.toString();
    }

    private String stringVal(Object value) {
        return value != null ? value.toString().trim() : null;
    }

    private Double doubleVal(Object value) {
        if (value == null) return null;
        if (value instanceof Number n) return n.doubleValue();
        try {
            return Double.parseDouble(value.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private LocalDate parseDate(Object value) {
        if (value == null || value.toString().isBlank()) return null;
        try {
            return LocalDate.parse(value.toString().substring(0, Math.min(10, value.toString().length())));
        } catch (Exception e) {
            return null;
        }
    }
}
