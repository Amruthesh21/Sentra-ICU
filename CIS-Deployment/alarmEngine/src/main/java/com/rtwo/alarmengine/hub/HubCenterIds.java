package com.rtwo.alarmengine.hub;

/**
 * Operational clinical data lives under the Connect Engine center (Mongo + vitals).
 * Hospital records are organizational; beds, admissions, and dashboards use this id.
 * Brand display name is Sentra ICU — CONNECT_ENGINE remains the technical sync key.
 */
public final class HubCenterIds {

    public static final String CONNECT_ENGINE = "RTWO";
    public static final String CONNECT_ENGINE_LOCATION = "JPN";
    /** User-facing product / center brand (never show CONNECT_ENGINE in UI). */
    public static final String BRAND_DISPLAY = "Sentra ICU";

    private HubCenterIds() {
    }
}
