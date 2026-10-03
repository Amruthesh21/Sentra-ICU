package com.sentraicu.alarmengine.hub;

import org.bson.Document;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;

/**
 * Copies the Mongo center document off the old product id onto SENTRA_ICU.
 */
@Component
public class CenterBrandMigration implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(CenterBrandMigration.class);

    private final MongoTemplate mongoTemplate;

    public CenterBrandMigration(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        Query current = new Query(Criteria.where("_id").is(HubCenterIds.CONNECT_ENGINE));
        Query legacy = new Query(Criteria.where("_id").is(HubCenterIds.LEGACY_CENTER_ID));
        Document existing = mongoTemplate.findOne(current, Document.class, "centerEntity");
        Document old = mongoTemplate.findOne(legacy, Document.class, "centerEntity");
        if (old == null) return;
        if (existing == null) {
            old.put("_id", HubCenterIds.CONNECT_ENGINE);
            old.put("centerName", HubCenterIds.BRAND_DISPLAY);
            old.put("_class", "com.sentraicu.alarmengine.mongo.CenterEntity");
            mongoTemplate.save(old, "centerEntity");
            log.info("Renamed Mongo center {} → {}", HubCenterIds.LEGACY_CENTER_ID, HubCenterIds.CONNECT_ENGINE);
        }
        mongoTemplate.remove(legacy, "centerEntity");
    }
}
