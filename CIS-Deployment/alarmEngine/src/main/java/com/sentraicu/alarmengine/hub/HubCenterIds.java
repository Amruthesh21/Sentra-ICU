package com.sentraicu.alarmengine.hub;

/**
 * Display brand for the product. Each hospital has its own operational center id
 * (usually the hospital code). LEGACY_CENTER_ID is only for migrating old rows.
 */
public final class HubCenterIds {

    public static final String CONNECT_ENGINE = "SENTRA_ICU";
    public static final String CONNECT_ENGINE_LOCATION = "JPN";
    public static final String BRAND_DISPLAY = "Sentra ICU";

    /** Previous shared center id. Only used to migrate existing rows and Mongo documents. */
    public static final String LEGACY_CENTER_ID = "RTWO";

    private HubCenterIds() {
    }
}
