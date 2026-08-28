package com.sentraicu.alarmengine.service;

import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class CisCenterService {

    private final MongoTemplate mongoTemplate;

    public CisCenterService(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    public String resolvePatientVisitId(String bedId) {
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
                    return null;
                }
                Object visitId = patientDoc.get("_id");
                if (visitId instanceof ObjectId objectId) {
                    return objectId.toHexString();
                }
                if (visitId != null) {
                    return visitId.toString();
                }
                return patientDoc.getString("mrn");
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
}
