package com.rtwo.alarmengine.auth.service;

import com.rtwo.alarmengine.hub.HubCenterIds;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;

/**
 * Resolves the operational center for hub APIs. Always Connect Engine (RTWO) so
 * hospital admin and super admin see the same beds, vitals, and admissions.
 */
@Service
public class HospitalContextService {

    public String resolveCenterId(HttpServletRequest request) {
        return HubCenterIds.CONNECT_ENGINE;
    }
}
