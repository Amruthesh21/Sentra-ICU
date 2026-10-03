package com.sentraicu.alarmengine.auth.service;

import com.sentraicu.alarmengine.auth.entity.HubUserPhotoEntity;
import com.sentraicu.alarmengine.auth.repo.HubUserPhotoRepository;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class ProfilePhotoService {

    private static final long MAX_BYTES = 1024 * 1024;
    private static final Map<String, String> MAGIC_TYPES = Map.of(
            "jpeg", MediaType.IMAGE_JPEG_VALUE,
            "png", MediaType.IMAGE_PNG_VALUE,
            "webp", "image/webp"
    );

    private final HubUserPhotoRepository photoRepository;

    public ProfilePhotoService(HubUserPhotoRepository photoRepository) {
        this.photoRepository = photoRepository;
    }

    public boolean hasPhoto(UUID userId) {
        return photoRepository.existsById(userId);
    }

    public Optional<HubUserPhotoEntity> get(UUID userId) {
        return photoRepository.findById(userId);
    }

    public ResponseEntity<byte[]> toResponse(HubUserPhotoEntity photo) {
        if (photo == null || photo.getPhotoBytes() == null) {
            return ResponseEntity.notFound().build();
        }
        MediaType type;
        try {
            type = MediaType.parseMediaType(photo.getContentType());
        } catch (Exception e) {
            type = MediaType.IMAGE_JPEG;
        }
        return ResponseEntity.ok()
                .contentType(type)
                .cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                .body(photo.getPhotoBytes());
    }

    @Transactional
    public void save(UUID userId, MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Choose a photo to upload");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new IllegalArgumentException("Photo must be 1 MB or smaller");
        }
        byte[] bytes = file.getBytes();
        String kind = sniff(bytes);
        if (kind == null) {
            throw new IllegalArgumentException("Use a JPEG, PNG, or WebP photo");
        }
        HubUserPhotoEntity photo = photoRepository.findById(userId).orElseGet(HubUserPhotoEntity::new);
        photo.setUserId(userId);
        photo.setContentType(MAGIC_TYPES.get(kind));
        photo.setPhotoBytes(bytes);
        photoRepository.save(photo);
    }

    @Transactional
    public void delete(UUID userId) {
        photoRepository.deleteById(userId);
    }

    static String sniff(byte[] bytes) {
        if (bytes == null || bytes.length < 12) return null;
        if (bytes[0] == (byte) 0xFF && bytes[1] == (byte) 0xD8 && bytes[2] == (byte) 0xFF) return "jpeg";
        if (bytes[0] == (byte) 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47) return "png";
        if (bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F'
                && bytes[8] == 'W' && bytes[9] == 'E' && bytes[10] == 'B' && bytes[11] == 'P') {
            return "webp";
        }
        return null;
    }
}
