package com.sentraicu.alarmengine.service;

import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class BedDeviceService {

    private static final String DEFAULT_CENTER = "RTWO";

    private final MongoTemplate mongoTemplate;
    private final DeviceCatalogService deviceCatalogService;

    public BedDeviceService(MongoTemplate mongoTemplate, DeviceCatalogService deviceCatalogService) {
        this.mongoTemplate = mongoTemplate;
        this.deviceCatalogService = deviceCatalogService;
    }

    public Document findBedByLabel(String bedLabel) {
        Document center = mongoTemplate.findOne(new Query(Criteria.where("_id").is(DEFAULT_CENTER)), Document.class, "centerEntity");
        if (center == null) {
            return null;
        }
        for (Document bed : getBedList(center)) {
            if (bedLabel.equals(bed.getString("bedLabel"))) {
                return bed;
            }
        }
        return null;
    }

    public String resolveBedLabel(String bedId) {
        if (bedId == null) {
            return null;
        }
        for (String variant : VitalsReadService.bedIdVariants(bedId)) {
            Document bed = findBedByLabel(variant.startsWith("ICU-1-") ? variant.substring("ICU-1-".length()) : variant);
            if (bed != null) {
                return bed.getString("bedLabel");
            }
        }
        return bedId.replace("ICU-1-", "");
    }

    public List<String> getBedDeviceIds(String bedLabel) {
        Document bed = findBedByLabel(bedLabel);
        if (bed == null) {
            return List.of();
        }
        return extractDeviceIds(bed);
    }

    public boolean hasSimulatorIp(Document bed) {
        if (bed == null) {
            return false;
        }
        String ip = CenterAdminService.decryptIp(bed.getString("ip"));
        return DeviceCatalogService.SIMULATOR_IP.equals(ip);
    }

    public boolean isLiveSimulatorBed(String bedLabel) {
        Document bed = findBedByLabel(bedLabel);
        return bed != null && hasSimulatorIp(bed);
    }

    @SuppressWarnings("unchecked")
    public List<String> extractDeviceIds(Document bed) {
        Object devicesObj = bed.get("devices");
        if (!(devicesObj instanceof List<?> list) || list.isEmpty()) {
            if (hasSimulatorIp(bed) || isVirtualSimulationBed(bed)) {
                return deviceCatalogService.defaultDevicesForSimulatorBed();
            }
            return List.of();
        }
        List<String> ids = new ArrayList<>();
        for (Object item : list) {
            if (item instanceof String s) {
                ids.add(s);
            } else if (item instanceof Document doc) {
                String id = doc.getString("deviceId");
                if (id == null) {
                    id = doc.getString("deviceName");
                }
                if (id != null) {
                    ids.add(id);
                }
            } else if (item instanceof Map<?, ?> map) {
                Object id = map.get("deviceId");
                if (id == null) {
                    id = map.get("deviceName");
                }
                if (id != null) {
                    ids.add(id.toString());
                }
            }
        }
        return ids;
    }

    private boolean isVirtualSimulationBed(Document bed) {
        if (bed == null || hasSimulatorIp(bed)) {
            return false;
        }
        return "virtual".equals(bed.getString("simulationMode")) || bed.get("patient") != null;
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
}
