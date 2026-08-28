package com.sentraicu.alarmengine.service;

import org.springframework.stereotype.Service;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AlarmNotifyStateService {

    private final Set<String> notifiedBreaches = ConcurrentHashMap.newKeySet();

    public boolean markNotifiedIfNew(String bedId, String paramName, String threshold) {
        return notifiedBreaches.add(AlarmAcknowledgmentService.key(bedId, paramName, threshold));
    }

    public void clear(String bedId, String paramName, String threshold) {
        notifiedBreaches.remove(AlarmAcknowledgmentService.key(bedId, paramName, threshold));
    }

    public void clearAllForParam(String bedId, String paramName) {
        String prefix = bedId + "|" + paramName + "|";
        notifiedBreaches.removeIf(key -> key.startsWith(prefix));
    }

    public void rearmBed(String bedId) {
        String prefix = bedId + "|";
        notifiedBreaches.removeIf(key -> key.startsWith(prefix));
    }
}
