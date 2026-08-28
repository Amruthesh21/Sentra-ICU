package com.sentraicu.alarmengine.auth.service;

import com.sentraicu.alarmengine.auth.entity.HubAuthUserEntity;
import com.sentraicu.alarmengine.auth.entity.HubRoleEntity;
import com.sentraicu.alarmengine.auth.repo.HubRoleRepository;
import com.sentraicu.alarmengine.auth.repo.HubUserRoleRepository;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class PermissionService {

    private static final List<String> SUPER_ADMIN_PERMISSIONS = List.of("*");

    private static final List<String> HOSPITAL_ADMIN_PERMISSIONS = Arrays.asList(
            "dashboard.universal", "dashboard.unit", "patient.read", "patient.write",
            "patient.create", "patient.update", "patient.delete",
            "bed.read", "bed.config", "center.read", "center.create",
            "device.read", "device.config", "user.read", "user.create", "user.update",
            "role.read", "role.create", "role.update", "alarm.read", "alarm.ack", "alarm.config",
            "waveform.read", "trends.read", "reports.read", "reports.write",
            "audit.read", "kpi.read", "scoring.read"
    );

    private final HubUserRoleRepository userRoleRepository;
    private final HubRoleRepository roleRepository;

    public PermissionService(HubUserRoleRepository userRoleRepository, HubRoleRepository roleRepository) {
        this.userRoleRepository = userRoleRepository;
        this.roleRepository = roleRepository;
    }

    public List<String> permissionsFor(HubAuthUserEntity user) {
        if (user.isSuperAdmin()) {
            return SUPER_ADMIN_PERMISSIONS;
        }
        if ("HOSPITAL_ADMIN".equalsIgnoreCase(user.getRole()) || "ADMIN".equalsIgnoreCase(user.getRole())) {
            return HOSPITAL_ADMIN_PERMISSIONS;
        }

        Set<String> merged = new LinkedHashSet<>();
        userRoleRepository.findByUserId(user.getId()).forEach(link -> {
            roleRepository.findById(link.getRoleId()).ifPresent(role -> merged.addAll(role.getPermissions()));
        });
        if (!merged.isEmpty()) {
            return new ArrayList<>(merged);
        }

        if (user.getHospitalId() != null) {
            Optional<HubRoleEntity> namedRole = roleRepository
                    .findByHospitalIdAndNameIgnoreCase(user.getHospitalId(), user.getRole());
            if (namedRole.isPresent() && !namedRole.get().getPermissions().isEmpty()) {
                return namedRole.get().getPermissions();
            }
        }

        return PermissionCatalog.CLINICAL;
    }

    public boolean hasPermission(HubAuthUserEntity user, String permission) {
        List<String> perms = permissionsFor(user);
        if (perms.contains("*")) return true;
        return perms.contains(permission);
    }
}
