package com.rtwo.alarmengine.service;

import org.bson.Document;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

/**
 * MongoDB is the Hub source of truth. Connect Engine loads beds from MongoDB on startup only
 * (its /update API returns 403 in this deployment). This scheduler detects label drift and
 * triggers a debounced CE container restart so OT Connect shows every bed from the Hub.
 */
@Service
public class ConnectEngineBedSyncScheduler {

    private static final Logger log = LoggerFactory.getLogger(ConnectEngineBedSyncScheduler.class);
    private static final String CENTER_ID = "RTWO";

    private final MongoTemplate mongoTemplate;
    private final ConnectEngineClient connectEngineClient;
    private final ConnectEngineSyncService syncService;

    public ConnectEngineBedSyncScheduler(
            MongoTemplate mongoTemplate,
            ConnectEngineClient connectEngineClient,
            ConnectEngineSyncService syncService) {
        this.mongoTemplate = mongoTemplate;
        this.connectEngineClient = connectEngineClient;
        this.syncService = syncService;
    }

    @Scheduled(fixedDelay = 30000, initialDelay = 20000)
    public void checkBedDrift() {
        Set<String> mongoLabels = loadMongoBedLabels();
        if (mongoLabels.isEmpty()) {
            return;
        }

        Set<String> ceLabels = loadConnectEngineBedLabels();
        if (ceLabels.isEmpty()) {
            log.debug("Connect Engine retrieve unavailable — skip drift check");
            return;
        }

        if (mongoLabels.equals(ceLabels)) {
            return;
        }

        log.warn("Connect Engine bed drift — mongo: {}, CE: {}", mongoLabels, ceLabels);
        syncService.restartOnDrift();
    }

    @SuppressWarnings("unchecked")
    private Set<String> loadMongoBedLabels() {
        Document center = mongoTemplate.findOne(
                new Query(Criteria.where("_id").is(CENTER_ID)), Document.class, "centerEntity");
        if (center == null) {
            return Set.of();
        }

        Set<String> labels = new TreeSet<>();
        Object bedsObj = center.get("beds");
        if (bedsObj instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Document doc) {
                    addLabel(labels, doc.getString("bedLabel"));
                } else if (item instanceof Map<?, ?> map) {
                    addLabel(labels, String.valueOf(map.get("bedLabel")));
                }
            }
        }
        return labels;
    }

    @SuppressWarnings("unchecked")
    private Set<String> loadConnectEngineBedLabels() {
        Map<String, Object> live = connectEngineClient.retrieve();
        if (live.isEmpty()) {
            return Set.of();
        }

        Set<String> labels = new TreeSet<>();
        Object bedsObj = live.get("beds");
        if (bedsObj instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> map) {
                    addLabel(labels, String.valueOf(map.get("bedLabel")));
                }
            }
        }
        return labels;
    }

    private void addLabel(Set<String> labels, String label) {
        if (label != null && !label.isBlank() && !"null".equals(label)) {
            labels.add(label);
        }
    }
}
