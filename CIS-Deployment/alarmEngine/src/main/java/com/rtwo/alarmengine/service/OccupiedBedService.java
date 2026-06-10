package com.rtwo.alarmengine.service;

import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
public class OccupiedBedService {

    private static final String DEFAULT_CENTER = "RTWO";

    private final MongoTemplate mongoTemplate;

    public OccupiedBedService(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    /** Beds with an admitted patient in MongoDB — each gets independent vitals/trends. */
    public List<String> listMonitoredBedIds() {
        Set<String> bedIds = new LinkedHashSet<>();
        Document center = mongoTemplate.findById(DEFAULT_CENTER, Document.class, "centerEntity");
        if (center == null) {
            return List.of();
        }
        Object bedsObj = center.get("beds");
        if (!(bedsObj instanceof List<?> beds)) {
            return List.of();
        }
        for (Object item : beds) {
            if (!(item instanceof Document bed)) {
                continue;
            }
            if (bed.get("patient") == null) {
                continue;
            }
            String label = bed.getString("bedLabel");
            if (label != null) {
                bedIds.add("ICU-1-" + label);
            }
        }
        return new ArrayList<>(bedIds);
    }
}
