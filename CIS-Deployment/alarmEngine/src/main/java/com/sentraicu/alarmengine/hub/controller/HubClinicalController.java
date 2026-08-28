package com.sentraicu.alarmengine.hub.controller;

import com.sentraicu.alarmengine.auth.service.HospitalContextService;
import com.sentraicu.alarmengine.hub.service.HubClinicalService;
import com.sentraicu.alarmengine.hub.service.HubClinicalOcrService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/hub/clinical")
public class HubClinicalController {

    private final HubClinicalService clinicalService;
    private final HubClinicalOcrService ocrService;
    private final HospitalContextService hospitalContextService;

    public HubClinicalController(
            HubClinicalService clinicalService,
            HubClinicalOcrService ocrService,
            HospitalContextService hospitalContextService) {
        this.clinicalService = clinicalService;
        this.ocrService = ocrService;
        this.hospitalContextService = hospitalContextService;
    }

    @PostMapping("/ocr/parse")
    public ResponseEntity<Map<String, Object>> parseOcr(@RequestParam("file") MultipartFile file) throws IOException {
        return ResponseEntity.ok(ocrService.parseUpload(file));
    }

    @GetMapping("/context")
    public Map<String, Object> context(@RequestParam String bedId, HttpServletRequest request) {
        return clinicalService.getContext(bedId, hospitalContextService.resolveCenterId(request));
    }

    @GetMapping("/visits/{visitId}/history")
    public Map<String, Object> patientHistory(@PathVariable UUID visitId) {
        return clinicalService.getPatientHistory(visitId);
    }

    @GetMapping("/visits/{visitId}/notes")
    public List<Map<String, Object>> listNotes(@PathVariable UUID visitId) {
        return clinicalService.listNotes(visitId);
    }

    @PostMapping("/visits/{visitId}/notes")
    public ResponseEntity<Map<String, Object>> createNote(@PathVariable UUID visitId,
                                                          @RequestBody Map<String, Object> request) {
        return ResponseEntity.ok(clinicalService.createNote(visitId, request));
    }

    @PatchMapping("/notes/{noteId}")
    public ResponseEntity<Map<String, Object>> updateNote(@PathVariable UUID noteId,
                                                         @RequestBody Map<String, Object> request) {
        return ResponseEntity.ok(clinicalService.updateNote(noteId, request));
    }

    @GetMapping("/visits/{visitId}/orders")
    public List<Map<String, Object>> listOrders(@PathVariable UUID visitId) {
        return clinicalService.listOrders(visitId);
    }

    @PostMapping("/visits/{visitId}/orders")
    public ResponseEntity<Map<String, Object>> createOrder(@PathVariable UUID visitId,
                                                           @RequestBody Map<String, Object> request) {
        return ResponseEntity.ok(clinicalService.createOrder(visitId, request));
    }

    @PatchMapping("/orders/{orderId}")
    public ResponseEntity<Map<String, Object>> updateOrder(@PathVariable UUID orderId,
                                                           @RequestBody Map<String, Object> request) {
        return ResponseEntity.ok(clinicalService.updateOrderStatus(orderId, request));
    }

    @GetMapping("/visits/{visitId}/labs-imaging")
    public Map<String, Object> listLabsImaging(@PathVariable UUID visitId) {
        return clinicalService.listLabsAndImaging(visitId);
    }

    @PostMapping("/visits/{visitId}/labs")
    public ResponseEntity<Map<String, Object>> createLab(@PathVariable UUID visitId,
                                                         @RequestBody Map<String, Object> request) {
        return ResponseEntity.ok(clinicalService.createLab(visitId, request));
    }

    @PostMapping("/visits/{visitId}/imaging")
    public ResponseEntity<Map<String, Object>> createImaging(@PathVariable UUID visitId,
                                                             @RequestBody Map<String, Object> request) {
        return ResponseEntity.ok(clinicalService.createImaging(visitId, request));
    }
}
