package com.rtwo.alarmengine.hub;

/**
 * Operational ICU data always lives under the Connect Engine center (Mongo + vitals).
 * Hospital records are organizational; beds, admissions, and dashboards use this id.
 */
public final class HubCenterIds {

    public static final String CONNECT_ENGINE = "RTWO";
    public static final String CONNECT_ENGINE_LOCATION = "JPN";

    private HubCenterIds() {
    }
}
