package com.sentraicu.alarmengine.auth.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class ProfilePhotoServiceTest {

    @Test
    void sniffsJpegPngWebpAndRejectsGarbage() {
        assertEquals("jpeg", ProfilePhotoService.sniff(new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0, 0, 0, 0, 0, 0, 0, 0, 0}));
        assertEquals("png", ProfilePhotoService.sniff(new byte[] {(byte) 0x89, 0x50, 0x4E, 0x47, 0, 0, 0, 0, 0, 0, 0, 0}));
        assertEquals("webp", ProfilePhotoService.sniff(new byte[] {
                'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P'
        }));
        assertNull(ProfilePhotoService.sniff("not-an-image".getBytes()));
        assertNull(ProfilePhotoService.sniff(null));
    }
}
