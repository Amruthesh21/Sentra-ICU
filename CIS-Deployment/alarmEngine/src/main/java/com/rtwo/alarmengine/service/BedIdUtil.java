package com.rtwo.alarmengine.service;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public final class BedIdUtil {

    private BedIdUtil() {
    }

    /** Canonical alarm-engine bed id: ICU-1-{bedLabel}. */
    public static String canonicalAlarmBedId(String bedId) {
        if (bedId == null || bedId.isBlank()) {
            return bedId;
        }
        String decoded = bedId;
        try {
            if (bedId.contains("%")) {
                decoded = URLDecoder.decode(bedId, StandardCharsets.UTF_8);
            }
        } catch (Exception ignored) {
            decoded = bedId;
        }
        decoded = decoded.trim();
        if (decoded.regionMatches(true, 0, "ICU-1-", 0, "ICU-1-".length())) {
            decoded = decoded.substring("ICU-1-".length()).trim();
        }
        // Normalize "BED-01" / "BED-1" / "BED 1" → "ICU-1-BED 1" to match center bed labels
        java.util.regex.Matcher bedNum = java.util.regex.Pattern
                .compile("(?i)^BED[\\s_-]*0*(\\d+)$")
                .matcher(decoded);
        if (bedNum.matches()) {
            return "ICU-1-BED " + Integer.parseInt(bedNum.group(1));
        }
        return "ICU-1-" + decoded;
    }

    public static List<String> allLookupIds(String bedId) {
        Set<String> ids = new LinkedHashSet<>();
        String canonical = canonicalAlarmBedId(bedId);
        addVariant(ids, canonical);
        addVariant(ids, bedId);
        ids.addAll(VitalsReadService.bedIdVariants(bedId));
        ids.addAll(VitalsReadService.bedIdVariants(canonical));

        for (String id : new ArrayList<>(ids)) {
            addBedLabelVariants(ids, stripPrefix(id));
        }
        return ids.stream()
                .filter(v -> v != null && !v.isBlank())
                .toList();
    }

    private static void addVariant(Set<String> ids, String value) {
        if (value == null || value.isBlank()) {
            return;
        }
        String decoded = value;
        try {
            if (value.contains("%")) {
                decoded = URLDecoder.decode(value, StandardCharsets.UTF_8);
            }
        } catch (Exception ignored) {
            decoded = value;
        }
        ids.add(decoded);
    }

    private static String stripPrefix(String bedId) {
        if (bedId == null) return null;
        String t = bedId.trim();
        if (t.regionMatches(true, 0, "ICU-1-", 0, "ICU-1-".length())) {
            return t.substring("ICU-1-".length());
        }
        return t;
    }

    private static void addBedLabelVariants(Set<String> ids, String label) {
        if (label == null || label.isBlank()) {
            return;
        }
        String raw = label.trim();
        ids.add(raw);
        ids.add("ICU-1-" + raw);

        String collapsedSpaces = raw.replaceAll("\\s+", " ");
        ids.add(collapsedSpaces);
        ids.add("ICU-1-" + collapsedSpaces);

        String withHyphen = collapsedSpaces.replace(' ', '-');
        String withSpace = collapsedSpaces.replace('-', ' ');
        ids.add(withHyphen);
        ids.add(withSpace);
        ids.add("ICU-1-" + withHyphen);
        ids.add("ICU-1-" + withSpace);

        java.util.regex.Matcher m = java.util.regex.Pattern
                .compile("(?i)^BED[\\s_-]*0*(\\d+)$")
                .matcher(collapsedSpaces);
        if (m.matches()) {
            int num = Integer.parseInt(m.group(1));
            String n = String.valueOf(num);
            String padded = String.format("%02d", num);
            String bedSpace = "BED " + n;
            String bedHyphen = "BED-" + n;
            String bedPadded = "BED-" + padded;
            ids.add(bedSpace);
            ids.add(bedHyphen);
            ids.add(bedPadded);
            ids.add("BED " + padded);
            ids.add("ICU-1-" + bedSpace);
            ids.add("ICU-1-" + bedHyphen);
            ids.add("ICU-1-" + bedPadded);
            ids.add("ICU-1-BED " + padded);
        }
    }
}
