package com.sentraicu.alarmengine.auth.controller;

import com.sentraicu.alarmengine.auth.entity.HubAuthUserEntity;
import com.sentraicu.alarmengine.auth.security.AuthSecurity;
import com.sentraicu.alarmengine.auth.service.ProfilePhotoService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/profile")
public class ProfilePhotoController {

    private final AuthSecurity authSecurity;
    private final ProfilePhotoService photoService;

    public ProfilePhotoController(AuthSecurity authSecurity, ProfilePhotoService photoService) {
        this.authSecurity = authSecurity;
        this.photoService = photoService;
    }

    @GetMapping("/photo")
    public ResponseEntity<byte[]> getPhoto(HttpServletRequest request) {
        HubAuthUserEntity user = authSecurity.requireUser(request);
        return photoService.toResponse(photoService.get(user.getId()).orElse(null));
    }
}
