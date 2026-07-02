package com.rtwo.alarmengine.auth.service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class PermissionCatalog {

    /** Permissions assignable to clinical roles — each maps to a real hub feature */
    public static final List<String> HUB_ASSIGNABLE = List.of(
            "dashboard.universal", "dashboard.unit", "kpi.read",
            "patient.read", "patient.write", "patient.create", "patient.update", "patient.delete",
            "bed.read", "waveform.read", "trends.read",
            "alarm.read", "alarm.ack", "alarm.config",
            "clinical_notes.read", "clinical_notes.write",
            "orders.read", "orders.write",
            "reports.read", "reports.write",
            "scoring.read"
    );

    /** @deprecated use HUB_ASSIGNABLE */
    public static final List<String> ALL = HUB_ASSIGNABLE;

    public static final List<String> CLINICAL = Arrays.asList(
            "dashboard.universal", "dashboard.unit", "kpi.read",
            "patient.read", "patient.write", "patient.create", "patient.update",
            "bed.read", "waveform.read", "trends.read",
            "alarm.read", "alarm.ack",
            "clinical_notes.read", "clinical_notes.write",
            "orders.read", "orders.write",
            "reports.read", "scoring.read"
    );

    public static final List<String> NURSING = Arrays.asList(
            "dashboard.universal", "dashboard.unit",
            "patient.read", "patient.write", "patient.update",
            "bed.read", "waveform.read", "trends.read",
            "alarm.read", "alarm.ack",
            "clinical_notes.read", "clinical_notes.write",
            "orders.read", "reports.read", "scoring.read"
    );

    public static final List<String> RT = Arrays.asList(
            "dashboard.unit",
            "patient.read",
            "bed.read", "waveform.read", "trends.read",
            "alarm.read", "alarm.ack",
            "orders.read", "reports.read"
    );

    public static List<String> sanitizeAssignable(List<String> permissions) {
        if (permissions == null) return new ArrayList<>();
        return new ArrayList<>(permissions.stream()
                .filter(HUB_ASSIGNABLE::contains)
                .distinct()
                .toList());
    }

    public static Map<String, Object> catalogResponse() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("permissions", HUB_ASSIGNABLE);
        response.put("count", HUB_ASSIGNABLE.size());
        return response;
    }

    private PermissionCatalog() {}
}
