package com.rtwo.alarmengine.service;

import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.Period;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.HashSet;

@Service
public class PatientInfoService {

    private static final List<String> PATIENT_COLLECTIONS = List.of(
            "patientInfoEntity",
            "patientInfo"
    );

    private final MongoTemplate mongoTemplate;

    public PatientInfoService(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    public Map<String, Object> getPatientByBed(String bedId) {
        Map<String, Object> fromCenter = findPatientInCenterEntity(bedId);
        if (fromCenter != null) {
            if (fromCenter.get("patientName") != null) {
                enrichFromPatientInfoEntity(fromCenter);
                return fromCenter;
            }
            if ("cis-center".equals(fromCenter.get("source"))) {
                return fromCenter;
            }
        }

        for (String variant : VitalsReadService.bedIdVariants(bedId)) {
            for (String collection : PATIENT_COLLECTIONS) {
                Document doc = findPatientDoc(collection, variant);
                if (doc != null) {
                    return toPatientResponse(doc, bedId);
                }
            }
        }

        Document fromAlarmConfig = mongoTemplate.findOne(
                new Query(Criteria.where("bedId").is(bedId)),
                Document.class,
                "doctorAlarmConfig"
        );
        if (fromAlarmConfig != null && fromAlarmConfig.getString("patientName") != null) {
            Map<String, Object> fallback = new LinkedHashMap<>();
            fallback.put("bedId", bedId);
            fallback.put("patientName", fromAlarmConfig.getString("patientName"));
            fallback.put("patientMRN", fromAlarmConfig.getString("patientMRN"));
            fallback.put("source", "alarm-config");
            return fallback;
        }

        Map<String, Object> empty = new LinkedHashMap<>();
        empty.put("bedId", bedId);
        empty.put("source", "none");
        return empty;
    }

    public List<Map<String, Object>> listPatientsForDoctor(String doctorId) {
        List<Map<String, Object>> patients = new ArrayList<>();
        List<Document> configs = mongoTemplate.find(
                new Query(Criteria.where("doctorId").is(doctorId)),
                Document.class,
                "doctorAlarmConfig"
        );

        for (Document config : configs) {
            String bedId = config.getString("bedId");
            if (bedId == null) {
                continue;
            }
            Map<String, Object> patient = getPatientByBed(bedId);
            patients.add(patient);
        }
        return patients;
    }

    private Map<String, Object> findPatientInCenterEntity(String bedId) {
        Set<String> variants = new HashSet<>(VitalsReadService.bedIdVariants(bedId));
        List<Document> centers = mongoTemplate.findAll(Document.class, "centerEntity");

        for (Document center : centers) {
            Object bedsObj = center.get("beds");
            if (!(bedsObj instanceof List<?> beds)) {
                continue;
            }
            for (Object bedObj : beds) {
                if (!(bedObj instanceof Document bedDoc)) {
                    continue;
                }
                String bedLabel = bedDoc.getString("bedLabel");
                if (!bedMatches(bedLabel, variants)) {
                    continue;
                }

                Object patientObj = bedDoc.get("patient");
                if (!(patientObj instanceof Document patientDoc)) {
                    Map<String, Object> vacant = new LinkedHashMap<>();
                    vacant.put("bedId", bedId);
                    vacant.put("bedLabel", bedLabel);
                    vacant.put("source", "cis-center");
                    return vacant;
                }

                return mapCenterPatient(patientDoc, bedId, bedLabel);
            }
        }
        return null;
    }

    private boolean bedMatches(String bedLabel, Set<String> variants) {
        if (bedLabel == null || bedLabel.isBlank()) {
            return false;
        }
        if (variants.contains(bedLabel)) {
            return true;
        }
        if (variants.contains("ICU-1-" + bedLabel)) {
            return true;
        }
        if (bedLabel.startsWith("ICU-1-")) {
            return variants.contains(bedLabel.substring("ICU-1-".length()));
        }
        return false;
    }

    private Map<String, Object> mapCenterPatient(Document patientDoc, String requestedBedId, String bedLabel) {
        Map<String, Object> patient = new LinkedHashMap<>();
        patient.put("bedId", requestedBedId);
        patient.put("bedLabel", bedLabel);
        patient.put("patientName", firstNonNull(patientDoc, null, "name", "patientName"));
        patient.put("patientMRN", firstNonNull(patientDoc, null, "puid", "patientMRN", "mrn", "MRN"));
        patient.put("patientGender", firstNonNull(patientDoc, null, "gender", "sex", "patientGender"));
        patient.put("patientWeight", numericString(patientDoc.get("weight"), patientDoc.get("birthWeight")));
        patient.put("patientAge", calculateAge(patientDoc.get("dateOfBirth"), patientDoc.get("dob")));
        patient.put("patientUpid", firstNonNull(patientDoc, null, "mrn", "upid"));
        patient.put("source", "cis-center");
        return patient;
    }

    private void enrichFromPatientInfoEntity(Map<String, Object> patient) {
        String upid = (String) patient.get("patientUpid");
        if (upid == null || upid.isBlank()) {
            return;
        }

        Document entity = mongoTemplate.findOne(
                new Query(new Criteria().orOperator(
                        Criteria.where("_id").is(upid),
                        Criteria.where("upid").is(upid)
                )),
                Document.class,
                "patientInfoEntity"
        );
        if (entity == null) {
            return;
        }

        if (patient.get("patientName") == null) {
            patient.put("patientName", entity.getString("name"));
        }
        if (patient.get("patientGender") == null) {
            patient.put("patientGender", String.valueOf(entity.get("gender")));
        }
        if (patient.get("patientWeight") == null) {
            patient.put("patientWeight", numericString(entity.get("birthWeight"), null));
        }
        if (patient.get("patientAge") == null) {
            patient.put("patientAge", calculateAge(entity.get("dob"), null));
        }

        Object visits = entity.get("patientVisit");
        if (visits instanceof List<?> visitList && !visitList.isEmpty()) {
            Object first = visitList.get(0);
            if (first instanceof Document visitDoc) {
                String visitMrn = visitDoc.getString("mrn");
                if (visitMrn != null && !visitMrn.isBlank()) {
                    patient.put("patientMRN", visitMrn);
                }
            }
        }
        patient.put("source", "cis-center+patientInfo");
    }

    private Document findPatientDoc(String collection, String bedId) {
        Query query = new Query(new Criteria().orOperator(
                Criteria.where("bedId").is(bedId),
                Criteria.where("bedID").is(bedId),
                Criteria.where("bed").is(bedId),
                Criteria.where("bedName").is(bedId),
                Criteria.where("centerBedId").is(bedId)
        )).limit(1);
        return mongoTemplate.findOne(query, Document.class, collection);
    }

    private Map<String, Object> toPatientResponse(Document doc, String requestedBedId) {
        Map<String, Object> patient = new LinkedHashMap<>();
        patient.put("bedId", firstNonNull(doc, requestedBedId, "bedId", "bedID", "bed", "bedName"));
        patient.put("patientName", firstNonNull(doc, null, "patientName", "name", "firstName"));
        patient.put("patientMRN", firstNonNull(doc, null, "patientMRN", "mrn", "MRN", "medicalRecordNumber", "puid"));
        patient.put("patientAge", firstNonNull(doc, null, "age", "patientAge"));
        patient.put("patientGender", firstNonNull(doc, null, "gender", "sex", "patientGender"));
        patient.put("patientWeight", firstNonNull(doc, null, "weight", "patientWeight", "birthWeight"));
        patient.put("source", "mongodb");
        return patient;
    }

    private String calculateAge(Object dobField, Object altDobField) {
        LocalDate dob = toLocalDate(dobField);
        if (dob == null) {
            dob = toLocalDate(altDobField);
        }
        if (dob == null) {
            return null;
        }
        int years = Period.between(dob, LocalDate.now()).getYears();
        return years >= 0 ? String.valueOf(years) : null;
    }

    private LocalDate toLocalDate(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Date date) {
            return date.toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
        }
        if (value instanceof Instant instant) {
            return instant.atZone(ZoneId.systemDefault()).toLocalDate();
        }
        try {
            return Instant.parse(value.toString()).atZone(ZoneId.systemDefault()).toLocalDate();
        } catch (DateTimeParseException ignored) {
            try {
                return LocalDate.parse(value.toString().substring(0, Math.min(10, value.toString().length())));
            } catch (Exception e) {
                return null;
            }
        }
    }

    private String numericString(Object primary, Object fallback) {
        if (primary instanceof Number number) {
            double val = number.doubleValue();
            return val == Math.floor(val) ? String.valueOf((long) val) : String.valueOf(val);
        }
        if (primary != null && !primary.toString().isBlank()) {
            return primary.toString();
        }
        if (fallback instanceof Number number) {
            double val = number.doubleValue();
            return val == Math.floor(val) ? String.valueOf((long) val) : String.valueOf(val);
        }
        return fallback != null ? fallback.toString() : null;
    }

    private String firstNonNull(Document doc, String fallback, String... fields) {
        for (String field : fields) {
            Object value = doc.get(field);
            if (value != null && !value.toString().isBlank()) {
                return value.toString();
            }
        }
        return fallback;
    }
}
