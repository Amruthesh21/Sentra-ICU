package com.sentraicu.alarmengine.hub.service;

import com.sentraicu.alarmengine.hub.entity.HubBedEntity;
import com.sentraicu.alarmengine.hub.entity.HubPatientEntity;
import com.sentraicu.alarmengine.hub.entity.HubPatientVisitEntity;
import com.sentraicu.alarmengine.service.CenterAdminService;
import com.sentraicu.alarmengine.service.DeviceCatalogService;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.ZoneId;
import java.util.*;

/**
 * Writes CE-compatible documents to MongoDB after Postgres commits.
 * Postgres is master; Mongo is the Connect Engine operational mirror.
 *
 * No longer pushes to a live Connect Engine instance — this deployment's
 * device pipeline is deviceIngestion, not the original Connect Engine, and
 * there is no Connect Engine host reachable from this stack, so that push
 * always failed silently on every admission/discharge (caught in
 * ConnectEngineClient, logged at debug, no functional effect) while still
 * paying for a network round-trip each time. Removed rather than pointed
 * somewhere real, since nothing in this deployment consumes it.
 */
@Service
public class ConnectEngineSyncBridge {

    private static final Logger log = LoggerFactory.getLogger(ConnectEngineSyncBridge.class);
    private static final String CENTER_ID = "RTWO";
    private static final String CENTER_LOCATION = "JPN";

    private final MongoTemplate mongoTemplate;

    public ConnectEngineSyncBridge(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    public void syncAdmission(HubPatientEntity patient,
                              HubPatientVisitEntity visit,
                              HubBedEntity bed,
                              List<String> deviceIds,
                              String genderCode) {
        String centerId = bed.getCenterId() != null ? bed.getCenterId().toUpperCase(Locale.ROOT) : CENTER_ID;
        Document center = mongoTemplate.findOne(
                new Query(Criteria.where("_id").is(centerId)), Document.class, "centerEntity");
        if (center == null) {
            center = ensureMongoCenter(centerId);
        }

        List<Document> beds = getBedList(center);
        Document targetBed = findBed(beds, bed.getBedLabel());
        if (targetBed == null) {
            targetBed = createMongoBedFromPostgres(bed);
            beds.add(targetBed);
        }

        String upid = ensureMongoUpid(patient);
        String mongoVisitId = new ObjectId().toHexString();
        Instant now = visit.getAdmittedAt() != null ? visit.getAdmittedAt() : Instant.now();

        // Used to default to deviceCatalogService.defaultDevicesForSimulatorBed()
        // (the pre-rebrand ["BplUltimaPrime","Agilia","BplElisa600"] demo
        // catalog) whenever the admission form's "Device mapping" step was
        // left unchecked — which is virtually every admission, since that
        // step has nothing to do with the current deviceIngestion pipeline.
        // That meant almost every admission through the real Hub UI silently
        // wrote fake legacy device names into this bed's Mongo record,
        // regardless of what (if anything) was actually connected. Leave it
        // empty when nothing was actually selected instead of inventing data.
        if (deviceIds == null) {
            deviceIds = List.of();
        }

        String bedIp = CenterAdminService.decryptIp(targetBed.getString("ip"));
        boolean simBed = DeviceCatalogService.SIMULATOR_IP.equals(bedIp);
        targetBed.put("simulationMode", simBed ? "live" : "virtual");

        Document visitDoc = new Document();
        visitDoc.put("visitID", mongoVisitId);
        visitDoc.put("mrn", patient.getMrn());
        visitDoc.put("admissionDate", Date.from(now));
        visitDoc.put("severity", List.of(new Document("time", Date.from(now)).append("value", "I")));
        visitDoc.put("gestation", 1);

        Document patientEntity = mongoTemplate.findOne(
                new Query(Criteria.where("_id").is(upid)), Document.class, "patientInfoEntity");
        if (patientEntity == null) {
            patientEntity = new Document();
            patientEntity.put("_id", upid);
            patientEntity.put("_class", "com.rtwo.med.device.connect.mongo.dal.entities.PatientInfoEntity");
        }

        patientEntity.put("name", patient.getFullName());
        char genderChar = genderCode != null && !genderCode.isBlank()
                ? genderCode.charAt(0) : 'M';
        patientEntity.put("gender", genderChar);
        if (patient.getDateOfBirth() != null) {
            patientEntity.put("dob", Date.from(patient.getDateOfBirth()
                    .atStartOfDay(ZoneId.systemDefault()).toInstant()));
        }
        if (patient.getBirthWeightKg() != null) {
            patientEntity.put("birthWeight", patient.getBirthWeightKg());
        }

        @SuppressWarnings("unchecked")
        List<Document> visits = patientEntity.get("patientVisit") instanceof List<?> list
                ? new ArrayList<>((List<Document>) list) : new ArrayList<>();
        visits.add(visitDoc);
        patientEntity.put("patientVisit", visits);
        patientEntity.put("currentVisitId", mongoVisitId);
        mongoTemplate.save(patientEntity, "patientInfoEntity");

        Document bedPatient = new Document();
        bedPatient.put("_id", new ObjectId(mongoVisitId));
        bedPatient.put("name", patient.getFullName());
        bedPatient.put("mrn", upid);
        bedPatient.put("puid", patient.getMrn());
        bedPatient.put("gender", genderCode != null ? genderCode : "M");
        if (patient.getBirthWeightKg() != null) {
            bedPatient.put("weight", patient.getBirthWeightKg());
        }
        if (patient.getDateOfBirth() != null) {
            bedPatient.put("dateOfBirth", Date.from(patient.getDateOfBirth()
                    .atStartOfDay(ZoneId.systemDefault()).toInstant()));
        }
        bedPatient.put("createdDtTm", Date.from(now));
        bedPatient.put("severity", "I");
        bedPatient.put("gestation", 1);

        targetBed.put("patient", bedPatient);
        targetBed.put("devices", deviceIds);

        mongoTemplate.updateFirst(
                new Query(Criteria.where("_id").is(centerId)),
                new Update().set("beds", beds),
                "centerEntity"
        );

        log.info("Mongo mirror synced for admit: {} on {} ({})", patient.getMrn(), bed.getBedLabel(), centerId);
    }

    public void syncDischarge(String bedLabel, String centerId) {
        String cid = centerId != null && !centerId.isBlank() ? centerId.toUpperCase(Locale.ROOT) : CENTER_ID;
        Document center = mongoTemplate.findOne(
                new Query(Criteria.where("_id").is(cid)), Document.class, "centerEntity");
        if (center == null) {
            return;
        }
        List<Document> beds = getBedList(center);
        Document targetBed = findBed(beds, bedLabel);
        if (targetBed != null) {
            targetBed.remove("patient");
            mongoTemplate.updateFirst(
                    new Query(Criteria.where("_id").is(cid)),
                    new Update().set("beds", beds),
                    "centerEntity"
            );
            log.info("Mongo mirror synced for discharge: {} ({})", bedLabel, cid);
        }
    }

    public void ensureBedInPostgresFromMongo(HubBedEntity hubBed, Document mongoBed) {
        if (mongoBed == null) return;
        hubBed.setMongoBedId(mongoBed.getString("_id"));
        String ip = CenterAdminService.decryptIp(mongoBed.getString("ip"));
        hubBed.setDeviceIp(ip);
        hubBed.setSimulationMode(mongoBed.getString("simulationMode"));
    }

    private String ensureMongoUpid(HubPatientEntity patient) {
        if (patient.getMongoUpid() != null && !patient.getMongoUpid().isBlank()) {
            return patient.getMongoUpid();
        }
        String upid = generateUpid();
        patient.setMongoUpid(upid);
        return upid;
    }

    private Document ensureMongoCenter(String centerId) {
        Document created = new Document();
        created.put("_id", centerId);
        created.put("centerName", centerId);
        created.put("centerLocation", CENTER_LOCATION);
        created.put("beds", new ArrayList<>());
        created.put("_class", "com.rtwo.med.device.connect.mongo.dal.entities.CenterEntity");
        mongoTemplate.save(created, "centerEntity");
        return created;
    }

    private Document createMongoBedFromPostgres(HubBedEntity bed) {
        Document mongoBed = new Document();
        mongoBed.put("_id", bed.getMongoBedId() != null ? bed.getMongoBedId() : UUID.randomUUID().toString());
        mongoBed.put("bedLabel", bed.getBedLabel());
        String ip = bed.getDeviceIp() != null ? bed.getDeviceIp() : DeviceCatalogService.SIMULATOR_IP;
        mongoBed.put("ip", CenterAdminService.encryptIp(ip));
        mongoBed.put("simulationMode", bed.getSimulationMode() != null ? bed.getSimulationMode() : "virtual");
        mongoBed.put("_class", "com.rtwo.med.device.connect.mongo.dal.entities.BedEntity");
        return mongoBed;
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

    private Document findBed(List<Document> beds, String bedLabel) {
        for (Document bed : beds) {
            if (bedLabel.equals(bed.getString("bedLabel"))) {
                return bed;
            }
        }
        return null;
    }

    private String generateUpid() {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        StringBuilder sb = new StringBuilder(12);
        Random random = new Random();
        for (int i = 0; i < 12; i++) {
            sb.append(chars.charAt(random.nextInt(chars.length())));
        }
        return sb.toString();
    }
}
