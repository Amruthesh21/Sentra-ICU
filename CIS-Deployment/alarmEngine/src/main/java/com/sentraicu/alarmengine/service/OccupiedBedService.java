package com.sentraicu.alarmengine.service;

import com.sentraicu.alarmengine.hub.repo.HubBedAssignmentRepository;
import com.sentraicu.alarmengine.hub.repo.HubBedRepository;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
public class OccupiedBedService {

    private static final String DEFAULT_CENTER = "RTWO";

    private final MongoTemplate mongoTemplate;
    private final HubBedRepository hubBedRepository;
    private final HubBedAssignmentRepository hubAssignmentRepository;

    public OccupiedBedService(MongoTemplate mongoTemplate,
                              HubBedRepository hubBedRepository,
                              HubBedAssignmentRepository hubAssignmentRepository) {
        this.mongoTemplate = mongoTemplate;
        this.hubBedRepository = hubBedRepository;
        this.hubAssignmentRepository = hubAssignmentRepository;
    }

    /** Beds with an admitted patient — each gets independent vitals/trends and alarm evaluation. */
    public List<String> listMonitoredBedIds() {
        Set<String> bedIds = new LinkedHashSet<>();
        addMongoOccupiedBeds(bedIds);
        addHubOccupiedBeds(bedIds);
        return new ArrayList<>(bedIds);
    }

    private void addMongoOccupiedBeds(Set<String> bedIds) {
        Document center = mongoTemplate.findById(DEFAULT_CENTER, Document.class, "centerEntity");
        if (center == null) {
            return;
        }
        Object bedsObj = center.get("beds");
        if (!(bedsObj instanceof List<?> beds)) {
            return;
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
                bedIds.add(BedIdUtil.canonicalAlarmBedId(label));
            }
        }
    }

    private void addHubOccupiedBeds(Set<String> bedIds) {
        hubAssignmentRepository.findByActiveTrue().forEach(assignment -> {
            hubBedRepository.findById(assignment.getBedId()).ifPresent(bed -> {
                if (bed.getBedLabel() != null) {
                    bedIds.add(BedIdUtil.canonicalAlarmBedId(bed.getBedLabel()));
                }
            });
        });
    }

    public boolean isBedOccupied(String bedId) {
        String canonical = BedIdUtil.canonicalAlarmBedId(bedId);
        for (String variant : BedIdUtil.allLookupIds(canonical)) {
            String label = variant.startsWith("ICU-1-") ? variant.substring("ICU-1-".length()) : variant;
            if (hubBedRepository.findByCenterIdAndBedLabel(DEFAULT_CENTER, label)
                    .flatMap(bed -> hubAssignmentRepository.findByBedIdAndActiveTrue(bed.getId()))
                    .isPresent()) {
                return true;
            }
        }
        Document center = mongoTemplate.findById(DEFAULT_CENTER, Document.class, "centerEntity");
        if (center == null) {
            return false;
        }
        Set<String> labels = new LinkedHashSet<>();
        for (String variant : BedIdUtil.allLookupIds(canonical)) {
            labels.add(variant.startsWith("ICU-1-") ? variant.substring("ICU-1-".length()) : variant);
        }
        for (Document bed : getMongoBeds(center)) {
            if (labels.contains(bed.getString("bedLabel")) && bed.get("patient") != null) {
                return true;
            }
        }
        return false;
    }

    @SuppressWarnings("unchecked")
    private List<Document> getMongoBeds(Document center) {
        Object bedsObj = center.get("beds");
        List<Document> beds = new ArrayList<>();
        if (bedsObj instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Document doc) {
                    beds.add(doc);
                }
            }
        }
        return beds;
    }
}
