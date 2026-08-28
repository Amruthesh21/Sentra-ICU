package com.sentraicu.alarmengine.service;

import com.sentraicu.alarmengine.dto.DeviceDataMessage;
import org.bson.Document;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.IndexOperations;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Persists vitals snapshots for long-term trends and ICU reports.
 * Connect Engine writes {@code historyVitals} for device streams; this archive
 * ensures hub patients always have tagged, queryable history even when CE tagging lags.
 */
@Service
public class VitalsArchiveService {

    public static final String COLLECTION = "hubTrendVitals";

    private static final Logger log = LoggerFactory.getLogger(VitalsArchiveService.class);

    private final MongoTemplate mongoTemplate;
    private final CisCenterService cisCenterService;
    private final long archiveIntervalMs;

    private final ConcurrentHashMap<String, Long> lastArchiveByBed = new ConcurrentHashMap<>();

    public VitalsArchiveService(MongoTemplate mongoTemplate,
                                CisCenterService cisCenterService,
                                @Value("${vitals.archive.interval-ms:300000}") long archiveIntervalMs) {
        this.mongoTemplate = mongoTemplate;
        this.cisCenterService = cisCenterService;
        this.archiveIntervalMs = Math.max(60_000L, archiveIntervalMs);
    }

    @PostConstruct
    void ensureIndexes() {
        try {
            IndexOperations ops = mongoTemplate.indexOps(COLLECTION);
            ops.ensureIndex(new Index().on("timestamp", org.springframework.data.domain.Sort.Direction.ASC));
            ops.ensureIndex(new Index().on("metadata.patientId", org.springframework.data.domain.Sort.Direction.ASC)
                    .on("timestamp", org.springframework.data.domain.Sort.Direction.ASC));
            ops.ensureIndex(new Index().on("bedId", org.springframework.data.domain.Sort.Direction.ASC)
                    .on("timestamp", org.springframework.data.domain.Sort.Direction.ASC));
        } catch (Exception e) {
            log.debug("hubTrendVitals index setup skipped: {}", e.getMessage());
        }
    }

  /**
     * Archive at most once per {@code vitals.archive.interval-ms} (default 5 min) per bed.
     */
    public void archiveIfDue(String bedId, DeviceDataMessage message) {
        if (bedId == null || message == null || !hasAttributes(message)) {
            return;
        }
        String normalized = normalizeBedId(bedId);
        long now = System.currentTimeMillis();
        Long last = lastArchiveByBed.get(normalized);
        if (last != null && now - last < archiveIntervalMs) {
            return;
        }
        lastArchiveByBed.put(normalized, now);
        persist(normalized, message);
    }

    private void persist(String bedId, DeviceDataMessage message) {
        try {
            String patientVisitId = cisCenterService.resolvePatientVisitId(bedId);
            Instant ts = Instant.now();

            Document metadata = new Document();
            metadata.put("patientId", patientVisitId);
            metadata.put("bedId", bedId);
            metadata.put("source", "alarm-engine-archive");
            metadata.put("deviceType", message.getDeviceType());

            Document doc = new Document();
            doc.put("timestamp", Date.from(ts));
            doc.put("bedId", bedId);
            doc.put("metadata", metadata);
            doc.put("primaryAttributes", toAttrDocs(message.getPrimaryAttributes()));
            doc.put("secondaryAttributes", toAttrDocs(message.getSecondaryAttributes()));
            doc.put("additionalAttributes", List.of());

            mongoTemplate.insert(doc, COLLECTION);
            log.debug("Archived vitals for {} at {}", bedId, ts);
        } catch (Exception e) {
            log.warn("Vitals archive failed for {}: {}", bedId, e.getMessage());
        }
    }

    private List<Document> toAttrDocs(List<DeviceDataMessage.VitalAttribute> attributes) {
        List<Document> docs = new ArrayList<>();
        if (attributes == null) {
            return docs;
        }
        for (DeviceDataMessage.VitalAttribute attr : attributes) {
            if (attr.getParamName() == null || attr.getValue() == null) {
                continue;
            }
            Document d = new Document();
            d.put("paramName", attr.getParamName());
            d.put("value", attr.getValue());
            if (attr.getUnit() != null) {
                d.put("unit", attr.getUnit());
            }
            docs.add(d);
        }
        return docs;
    }

    private boolean hasAttributes(DeviceDataMessage message) {
        return (message.getPrimaryAttributes() != null && !message.getPrimaryAttributes().isEmpty())
                || (message.getSecondaryAttributes() != null && !message.getSecondaryAttributes().isEmpty());
    }

    private String normalizeBedId(String bedId) {
        if (bedId != null && bedId.matches("BED-\\d+")) {
            return "ICU-1-" + bedId;
        }
        return bedId;
    }
}
