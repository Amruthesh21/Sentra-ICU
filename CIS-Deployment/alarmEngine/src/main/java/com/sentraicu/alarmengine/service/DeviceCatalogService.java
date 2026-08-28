package com.sentraicu.alarmengine.service;

import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class DeviceCatalogService {

    private static final List<String> POC_DEVICE_ORDER = List.of(
            "BplUltimaPrime", "Agilia", "BplElisa600"
    );

    /** Device simulator container IP in docker-compose */
    public static final String SIMULATOR_IP = "172.25.0.8";

    private final MongoTemplate mongoTemplate;

    public DeviceCatalogService(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    public List<Map<String, Object>> listAvailableDevices() {
        List<Document> configs = mongoTemplate.findAll(Document.class, "deviceConfigEntity");
        List<Map<String, Object>> devices = new ArrayList<>();

        for (Document config : configs) {
            String deviceName = config.getString("deviceName");
            if (deviceName == null) {
                deviceName = config.getString("_id");
            }
            if (deviceName == null || !POC_DEVICE_ORDER.contains(deviceName)) {
                continue;
            }

            Map<String, Object> device = new LinkedHashMap<>();
            device.put("deviceId", deviceName);
            device.put("deviceName", deviceName);
            device.put("deviceType", config.getString("deviceType"));
            device.put("simulatorIp", SIMULATOR_IP);
            device.put("parameters", extractParameters(config));
            devices.add(device);
        }

        if (devices.isEmpty()) {
            for (String id : POC_DEVICE_ORDER) {
                devices.add(switch (id) {
                    case "BplUltimaPrime" -> defaultDevice(id, "patient-monitor",
                            List.of("SpO2", "Pulse", "Temp1", "Temp2", "Resp.Rate", "Heart Rate"));
                    case "Agilia" -> defaultDevice(id, "syringe-pump",
                            List.of("Inf Rate", "Inf Vol", "Drug Name", "Pump Status", "Pump Mode"));
                    case "BplElisa600" -> defaultDevice(id, "ventilator",
                            List.of("Resp.Rate", "PEEP", "MV", "Peak", "VT", "FiO2"));
                    default -> defaultDevice(id, "device", List.of());
                });
            }
        } else {
            devices.sort((a, b) -> Integer.compare(
                    POC_DEVICE_ORDER.indexOf(String.valueOf(a.get("deviceId"))),
                    POC_DEVICE_ORDER.indexOf(String.valueOf(b.get("deviceId")))));
        }
        return devices;
    }

    public List<String> defaultDevicesForSimulatorBed() {
        return List.of("BplUltimaPrime", "Agilia", "BplElisa600");
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> extractParameters(Document config) {
        List<Map<String, Object>> params = new ArrayList<>();
        Object attrs = config.get("attributes");
        if (!(attrs instanceof List<?> list)) {
            return params;
        }
        for (Object item : list) {
            if (!(item instanceof Document attr)) {
                continue;
            }
            if (Boolean.FALSE.equals(attr.get("enabled"))) {
                continue;
            }
            Map<String, Object> p = new LinkedHashMap<>();
            p.put("name", attr.getString("name"));
            p.put("group", attr.getString("group"));
            p.put("unit", inferUnit(attr.getString("name")));
            params.add(p);
        }
        return params;
    }

    private Map<String, Object> defaultDevice(String id, String type, List<String> paramNames) {
        Map<String, Object> device = new LinkedHashMap<>();
        device.put("deviceId", id);
        device.put("deviceName", id);
        device.put("deviceType", type);
        device.put("simulatorIp", SIMULATOR_IP);
        List<Map<String, Object>> params = new ArrayList<>();
        for (String name : paramNames) {
            params.add(Map.of("name", name, "group", "primary", "unit", inferUnit(name)));
        }
        device.put("parameters", params);
        return device;
    }

    private String inferUnit(String name) {
        if (name == null) return "";
        return switch (name) {
            case "SpO2" -> "%";
            case "Pulse", "Heart Rate", "Resp.Rate" -> "bpm";
            case "Temp1", "Temp2" -> "°C";
            case "PEEP", "Peak" -> "cmH2O";
            case "MV" -> "L/min";
            case "VT" -> "ml";
            case "Inf Rate" -> "ml/h";
            case "Inf Vol" -> "ml";
            case "FiO2" -> "%";
            default -> "";
        };
    }
}
