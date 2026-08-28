package com.sentraicu.alarmengine.service;

import com.sentraicu.alarmengine.dto.DeviceDataMessage;
import org.bson.Document;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class VitalsReadService {

    private static final List<String> CIS_DEVICE_PRIORITY = List.of(
            "BplUltimaPrime",
            "Agilia",
            "BplElisa600",
            "Elisa600"
    );

    private final MongoTemplate mongoTemplate;
    private final LatestVitalsStore latestVitalsStore;
    private final CisCenterService cisCenterService;
    private final BedDeviceService bedDeviceService;
    private final OccupiedBedService occupiedBedService;

    public VitalsReadService(MongoTemplate mongoTemplate,
                             LatestVitalsStore latestVitalsStore,
                             CisCenterService cisCenterService,
                             BedDeviceService bedDeviceService,
                             OccupiedBedService occupiedBedService) {
        this.mongoTemplate = mongoTemplate;
        this.latestVitalsStore = latestVitalsStore;
        this.cisCenterService = cisCenterService;
        this.bedDeviceService = bedDeviceService;
        this.occupiedBedService = occupiedBedService;
    }

    public Map<String, Object> getLatestVitals(String bedId) {
        if (!hasAdmittedPatient(bedId)) {
            return emptyVitals(bedId);
        }

        DeviceDataMessage cached = latestVitalsStore.get(bedId);
        if (cached == null) {
            for (String variant : bedIdVariants(bedId)) {
                cached = latestVitalsStore.get(variant);
                if (cached != null) {
                    break;
                }
            }
        }

        if (cached != null && hasAttributes(cached)) {
            String source = "CIS-merged".equals(cached.getDeviceType()) ? "cis-live" : "rabbitmq";
            return toResponse(bedId, cached, source);
        }

        Map<String, Object> merged = loadMergedVitalsFromMongo(bedId);
        if (merged != null && !merged.isEmpty()) {
            return merged;
        }

        merged = loadVitalsByBedDevices(bedId);
        if (merged != null && !merged.isEmpty()) {
            return merged;
        }

        return emptyVitals(bedId);
    }

    private Map<String, Object> emptyVitals(String bedId) {
        Map<String, Object> empty = new LinkedHashMap<>();
        empty.put("bedId", bedId);
        empty.put("primaryAttributes", List.of());
        empty.put("secondaryAttributes", List.of());
        empty.put("source", "none");
        return empty;
    }

    private boolean hasAdmittedPatient(String bedId) {
        String visitId = cisCenterService.resolvePatientVisitId(bedId);
        if (visitId != null && !visitId.isBlank()) {
            return true;
        }
        return occupiedBedService.isBedOccupied(bedId);
    }

    public Map<String, Object> loadMergedVitalsFromMongo(String bedId) {
        String patientVisitId = cisCenterService.resolvePatientVisitId(bedId);
        if (patientVisitId == null || patientVisitId.isBlank()) {
            return null;
        }

        List<Map<String, Object>> primary = new ArrayList<>();
        List<Map<String, Object>> secondary = new ArrayList<>();
        Instant latestTimestamp = null;
        Set<String> seenParams = new LinkedHashSet<>();

        Set<String> deviceIds = discoverDeviceIds(patientVisitId);
        List<String> orderedDevices = new ArrayList<>(CIS_DEVICE_PRIORITY);
        for (String deviceId : deviceIds) {
            if (!orderedDevices.contains(deviceId)) {
                orderedDevices.add(deviceId);
            }
        }

        for (String deviceId : orderedDevices) {
            Document doc = findLatestDocForPatientDevice(patientVisitId, deviceId);
            if (doc == null) {
                continue;
            }
            Instant docTs = parseInstant(doc.get("timestamp"));
            if (docTs != null && (latestTimestamp == null || docTs.isAfter(latestTimestamp))) {
                latestTimestamp = docTs;
            }
            mergeAttributes(primary, secondary, seenParams, doc);
        }

        if (primary.isEmpty() && secondary.isEmpty()) {
            return null;
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("bedId", bedId);
        response.put("timestamp", latestTimestamp != null ? latestTimestamp.toString() : Instant.now().toString());
        response.put("deviceType", "CIS-merged");
        response.put("primaryAttributes", primary);
        response.put("secondaryAttributes", secondary);
        response.put("source", "mongodb");
        return response;
    }

    /** Fallback when patient visit has no history yet — only for the live simulator bed. */
    public Map<String, Object> loadVitalsByBedDevices(String bedId) {
        if (!hasAdmittedPatient(bedId)) {
            return null;
        }
        String bedLabel = bedDeviceService.resolveBedLabel(bedId);
        if (!bedDeviceService.isLiveSimulatorBed(bedLabel)) {
            return null;
        }

        String patientVisitId = cisCenterService.resolvePatientVisitId(bedId);
        List<String> deviceIds = bedDeviceService.getBedDeviceIds(bedLabel);
        if (deviceIds.isEmpty()) {
            return null;
        }

        List<Map<String, Object>> primary = new ArrayList<>();
        List<Map<String, Object>> secondary = new ArrayList<>();
        Instant latestTimestamp = null;
        Set<String> seenParams = new LinkedHashSet<>();

        for (String deviceId : deviceIds) {
            Document doc = findLatestDocForPatientDevice(patientVisitId, deviceId);
            if (doc == null) {
                continue;
            }
            Instant docTs = parseInstant(doc.get("timestamp"));
            if (docTs != null && (latestTimestamp == null || docTs.isAfter(latestTimestamp))) {
                latestTimestamp = docTs;
            }
            mergeAttributes(primary, secondary, seenParams, doc);
        }

        if (primary.isEmpty() && secondary.isEmpty()) {
            for (String deviceId : deviceIds) {
                Document doc = findLatestDocForDevice(deviceId);
                if (doc == null) {
                    continue;
                }
                Instant docTs = parseInstant(doc.get("timestamp"));
                if (docTs != null && (latestTimestamp == null || docTs.isAfter(latestTimestamp))) {
                    latestTimestamp = docTs;
                }
                mergeAttributes(primary, secondary, seenParams, doc);
            }
        }

        if (primary.isEmpty() && secondary.isEmpty()) {
            return null;
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("bedId", normalizeBedId(bedId));
        response.put("timestamp", latestTimestamp != null ? latestTimestamp.toString() : Instant.now().toString());
        response.put("deviceType", "CIS-merged");
        response.put("primaryAttributes", primary);
        response.put("secondaryAttributes", secondary);
        response.put("source", "mongodb-device");
        return response;
    }

    private Document findLatestDocForDevice(String deviceId) {
        Query query = new Query(Criteria.where("metadata.deviceId").is(deviceId))
                .with(Sort.by(Sort.Direction.DESC, "timestamp"))
                .limit(1);
        return mongoTemplate.findOne(query, Document.class, "historyVitals");
    }

    public DeviceDataMessage toDeviceDataMessage(String bedId, Map<String, Object> merged) {
        DeviceDataMessage message = new DeviceDataMessage();
        message.setBedId(normalizeBedId(bedId));
        message.setDeviceType((String) merged.getOrDefault("deviceType", "CIS-merged"));
        message.setTimestamp((String) merged.getOrDefault("timestamp", Instant.now().toString()));
        message.setPrimaryAttributes(toVitalAttributes((List<?>) merged.get("primaryAttributes")));
        message.setSecondaryAttributes(toVitalAttributes((List<?>) merged.get("secondaryAttributes")));
        return message;
    }

    private Set<String> discoverDeviceIds(String patientVisitId) {
        Query query = new Query(Criteria.where("metadata.patientId").is(patientVisitId));
        List<String> deviceIds = mongoTemplate.findDistinct(query, "metadata.deviceId", "historyVitals", String.class);
        return new LinkedHashSet<>(deviceIds);
    }

    private Document findLatestDocForPatientDevice(String patientVisitId, String deviceId) {
        Query query = new Query(Criteria.where("metadata.patientId").is(patientVisitId)
                .and("metadata.deviceId").is(deviceId))
                .with(Sort.by(Sort.Direction.DESC, "timestamp"))
                .limit(1);
        return mongoTemplate.findOne(query, Document.class, "historyVitals");
    }

    private void mergeAttributes(List<Map<String, Object>> primary,
                                 List<Map<String, Object>> secondary,
                                 Set<String> seenParams,
                                 Document doc) {
        appendAttributes(primary, secondary, seenParams, doc.get("primaryAttributes"), true);
        appendAttributes(primary, secondary, seenParams, doc.get("additionalAttributes"), false);
        appendAttributes(primary, secondary, seenParams, doc.get("secondaryAttributes"), false);

        Object data = doc.get("data");
        if (data instanceof Document dataDoc) {
            appendAttributes(primary, secondary, seenParams, dataDoc.get("primaryAttributes"), true);
            appendAttributes(primary, secondary, seenParams, dataDoc.get("additionalAttributes"), false);
            appendAttributes(primary, secondary, seenParams, dataDoc.get("secondaryAttributes"), false);
        }
    }

    @SuppressWarnings("unchecked")
    private void appendAttributes(List<Map<String, Object>> primary,
                                  List<Map<String, Object>> secondary,
                                  Set<String> seenParams,
                                  Object attributesObj,
                                  boolean preferPrimary) {
        if (!(attributesObj instanceof List<?> list)) {
            return;
        }
        for (Object item : list) {
            if (!(item instanceof Document attrDoc) && !(item instanceof Map<?, ?>)) {
                continue;
            }
            Document attr = item instanceof Document d ? d : new Document((Map<String, Object>) item);
            String paramName = firstNonBlank(attr.get("paramName"), attr.get("name"));
            if (paramName == null || paramName.isBlank() || seenParams.contains(paramName)) {
                continue;
            }
            Double value = toDouble(attr.get("value"));
            if (value == null) {
                continue;
            }

            Map<String, Object> normalized = new LinkedHashMap<>();
            normalized.put("paramName", paramName);
            normalized.put("value", value);
            normalized.put("unit", attr.get("unit"));

            if (preferPrimary) {
                primary.add(normalized);
            } else {
                secondary.add(normalized);
            }
            seenParams.add(paramName);

            if ("Pulse".equalsIgnoreCase(paramName) && !seenParams.contains("HeartRate")) {
                Map<String, Object> hr = new LinkedHashMap<>(normalized);
                hr.put("paramName", "HeartRate");
                secondary.add(hr);
                seenParams.add("HeartRate");
            }
            if ("Heart Rate".equalsIgnoreCase(paramName) && !seenParams.contains("HeartRate")) {
                Map<String, Object> hr = new LinkedHashMap<>(normalized);
                hr.put("paramName", "HeartRate");
                secondary.add(hr);
                seenParams.add("HeartRate");
            }
        }
    }

    private List<DeviceDataMessage.VitalAttribute> toVitalAttributes(List<?> attributes) {
        List<DeviceDataMessage.VitalAttribute> result = new ArrayList<>();
        if (attributes == null) {
            return result;
        }
        for (Object item : attributes) {
            if (!(item instanceof Map<?, ?> map)) {
                continue;
            }
            Object paramName = map.get("paramName");
            Object value = map.get("value");
            if (paramName == null || value == null) {
                continue;
            }
            DeviceDataMessage.VitalAttribute attr = new DeviceDataMessage.VitalAttribute();
            attr.setParamName(paramName.toString());
            attr.setValue(value instanceof Number number ? number.doubleValue() : toDouble(value));
            Object unit = map.get("unit");
            if (unit != null) {
                attr.setUnit(unit.toString());
            }
            if (attr.getValue() != null) {
                result.add(attr);
            }
        }
        return result;
    }

    private Map<String, Object> toResponse(String requestedBedId, DeviceDataMessage cached, String source) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("bedId", cached.getBedId() != null ? cached.getBedId() : requestedBedId);
        response.put("timestamp", cached.getTimestamp() != null ? cached.getTimestamp() : Instant.now().toString());
        response.put("deviceType", cached.getDeviceType());
        response.put("primaryAttributes", toAttributeMaps(cached.getPrimaryAttributes()));
        response.put("secondaryAttributes", toAttributeMaps(cached.getSecondaryAttributes()));
        response.put("source", source);
        return response;
    }

    private List<Map<String, Object>> toAttributeMaps(List<DeviceDataMessage.VitalAttribute> attributes) {
        List<Map<String, Object>> maps = new ArrayList<>();
        if (attributes == null) {
            return maps;
        }
        for (DeviceDataMessage.VitalAttribute attr : attributes) {
            if (attr.getParamName() == null || attr.getValue() == null) {
                continue;
            }
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("paramName", attr.getParamName());
            map.put("value", attr.getValue());
            map.put("unit", attr.getUnit());
            maps.add(map);
        }
        return maps;
    }

    private boolean hasAttributes(DeviceDataMessage cached) {
        return (cached.getPrimaryAttributes() != null && !cached.getPrimaryAttributes().isEmpty())
                || (cached.getSecondaryAttributes() != null && !cached.getSecondaryAttributes().isEmpty());
    }

    private Instant parseInstant(Object timestamp) {
        if (timestamp == null) {
            return null;
        }
        if (timestamp instanceof Instant instant) {
            return instant;
        }
        if (timestamp instanceof java.util.Date date) {
            return date.toInstant();
        }
        try {
            return Instant.parse(timestamp.toString());
        } catch (Exception e) {
            return null;
        }
    }

    private Double toDouble(Object value) {
        if (value == null) {
            return null;
        }
        String text = value.toString().trim();
        if (text.isEmpty() || "--".equals(text) || "null".equalsIgnoreCase(text)) {
            return null;
        }
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        try {
            return Double.parseDouble(text);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private String firstNonBlank(Object... values) {
        for (Object value : values) {
            if (value != null && !value.toString().isBlank()) {
                return value.toString();
            }
        }
        return null;
    }

    private String normalizeBedId(String bedId) {
        if (bedId != null && bedId.matches("BED-\\d+")) {
            return "ICU-1-" + bedId;
        }
        return bedId;
    }

    public static List<String> bedIdVariants(String bedId) {
        List<String> variants = new ArrayList<>();
        if (bedId == null || bedId.isBlank()) {
            return variants;
        }
        variants.add(bedId);
        if (bedId.startsWith("ICU-1-")) {
            variants.add(bedId.substring("ICU-1-".length()));
        } else if (!bedId.startsWith("ICU")) {
            variants.add("ICU-1-" + bedId);
        }
        return variants;
    }
}
