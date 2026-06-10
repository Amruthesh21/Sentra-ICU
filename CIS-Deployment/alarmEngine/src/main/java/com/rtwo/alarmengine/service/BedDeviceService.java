package com.rtwo.alarmengine.service;

import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

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

    /** Occupied beds without the physical simulator use derived per-bed vitals. */
    public boolean isVirtualSimulatorBed(String bedLabel) {
        Document bed = findBedByLabel(bedLabel);
        if (bed == null || hasSimulatorIp(bed)) {
            return false;
        }
        if (bed.get("patient") == null) {
            return false;
        }
        return "virtual".equals(bed.getString("simulationMode")) || !hasSimulatorIp(bed);
    }

    public Map<String, Object> getBedDeviceStatus(String bedId) {
        String bedLabel = resolveBedLabel(bedId);
        Document bed = findBedByLabel(bedLabel);
        List<String> configured = bed != null ? extractDeviceIds(bed) : List.of();
        boolean simConnected = bed != null && hasSimulatorIp(bed);
        boolean virtualSim = isVirtualSimulatorBed(bedLabel);

        Map<String, Map<String, Object>> paramToDevice = buildParamDeviceMap();
        Set<String> availableParams = configured.stream()
                .flatMap(deviceId -> getParamsForDevice(deviceId, paramToDevice).stream())
                .collect(Collectors.toSet());

        List<Map<String, Object>> devices = deviceCatalogService.listAvailableDevices().stream()
                .map(d -> {
                    Map<String, Object> copy = new LinkedHashMap<>(d);
                    String id = String.valueOf(d.get("deviceId"));
                    copy.put("connected", configured.contains(id));
                    copy.put("liveCapable", simConnected && configured.contains(id));
                    copy.put("virtualCapable", virtualSim && configured.contains(id));
                    return copy;
                })
                .toList();

        List<Map<String, Object>> unavailableParameters = new ArrayList<>();
        for (Map.Entry<String, Map<String, Object>> entry : paramToDevice.entrySet()) {
            if (!availableParams.contains(entry.getKey())) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("name", entry.getKey());
                row.put("deviceId", entry.getValue().get("deviceId"));
                row.put("deviceName", entry.getValue().get("deviceName"));
                row.put("reason", "Device not connected to this bed");
                unavailableParameters.add(row);
            }
        }

        List<Map<String, Object>> availableParameterDetails = new ArrayList<>();
        for (String param : availableParams) {
            Map<String, Object> meta = paramToDevice.get(param);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("name", param);
            if (meta != null) {
                row.put("deviceId", meta.get("deviceId"));
                row.put("deviceName", meta.get("deviceName"));
            }
            availableParameterDetails.add(row);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("bedLabel", bedLabel);
        result.put("bedId", bedId);
        result.put("simulatorConnected", simConnected);
        result.put("virtualSimulatorActive", virtualSim);
        result.put("liveVitalsCapable", simConnected);
        result.put("deviceIp", bed != null ? CenterAdminService.decryptIp(bed.getString("ip")) : null);
        result.put("configuredDevices", configured);
        result.put("devices", devices);
        result.put("availableParameters", new ArrayList<>(availableParams));
        result.put("availableParameterDetails", availableParameterDetails);
        result.put("unavailableParameters", unavailableParameters);
        return result;
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

    private Map<String, Map<String, Object>> buildParamDeviceMap() {
        Map<String, Map<String, Object>> map = new LinkedHashMap<>();
        for (Map<String, Object> device : deviceCatalogService.listAvailableDevices()) {
            String deviceId = String.valueOf(device.get("deviceId"));
            Object params = device.get("parameters");
            if (params instanceof List<?> list) {
                for (Object p : list) {
                    if (p instanceof Map<?, ?> param) {
                        String name = String.valueOf(param.get("name"));
                        map.put(name, Map.of("deviceId", deviceId, "deviceName", device.get("deviceName")));
                    }
                }
            }
        }
        return map;
    }

    private List<String> getParamsForDevice(String deviceId, Map<String, Map<String, Object>> paramToDevice) {
        return paramToDevice.entrySet().stream()
                .filter(e -> deviceId.equals(e.getValue().get("deviceId")))
                .map(Map.Entry::getKey)
                .toList();
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
