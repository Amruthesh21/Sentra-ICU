package com.rtwo.alarmengine.hub.service;

import net.sourceforge.tess4j.ITesseract;
import net.sourceforge.tess4j.Tesseract;
import net.sourceforge.tess4j.TesseractException;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class HubClinicalOcrService {

    private static final Logger log = LoggerFactory.getLogger(HubClinicalOcrService.class);
    private static final int MIN_PDF_TEXT_CHARS = 80;
    private static final int MAX_PDF_PAGES_OCR = 5;

    private final String tessDataPath;
    private final ClinicalDocumentOcrParser parser;

    public HubClinicalOcrService(@Value("${hub.ocr.tessdata-path}") String tessDataPath,
                                 ClinicalDocumentOcrParser parser) {
        this.tessDataPath = tessDataPath;
        this.parser = parser;
    }

    public Map<String, Object> parseUpload(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Upload a PDF or image file");
        }
        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "upload";
        String contentType = file.getContentType() != null ? file.getContentType() : "";
        byte[] bytes = file.getBytes();

        String rawText;
        String source;
        if (isPdf(filename, contentType)) {
            rawText = extractPdfText(bytes);
            source = "pdf";
        } else if (isImage(filename, contentType)) {
            rawText = ocrImageBytes(bytes);
            source = "image-ocr";
        } else {
            throw new IllegalArgumentException("Unsupported file type — use PDF, JPG, PNG, or WEBP");
        }

        if (rawText == null || rawText.isBlank()) {
            throw new IllegalArgumentException("No readable text found — try a clearer photo or scan");
        }

        Map<String, Object> parsed = parser.parse(rawText);
        parsed.put("rawText", rawText.trim());
        parsed.put("source", source);
        parsed.put("fileName", filename);
        log.info("OCR parsed {} — type={}, labs={}, hasImaging={}",
                filename, parsed.get("documentType"),
                ((List<?>) parsed.getOrDefault("labs", List.of())).size(),
                parsed.get("imaging") != null);
        return parsed;
    }

    private boolean isPdf(String filename, String contentType) {
        return filename.toLowerCase(Locale.ROOT).endsWith(".pdf")
                || contentType.toLowerCase(Locale.ROOT).contains("pdf");
    }

    private boolean isImage(String filename, String contentType) {
        String lower = filename.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png")
                || lower.endsWith(".webp") || lower.endsWith(".bmp") || lower.endsWith(".tif")
                || lower.endsWith(".tiff")) {
            return true;
        }
        String ct = contentType.toLowerCase(Locale.ROOT);
        return ct.startsWith("image/");
    }

    private String extractPdfText(byte[] bytes) throws IOException {
        try (PDDocument document = Loader.loadPDF(bytes)) {
            PDFTextStripper stripper = new PDFTextStripper();
            String text = stripper.getText(document);
            if (text != null && text.trim().length() >= MIN_PDF_TEXT_CHARS) {
                return text;
            }
            return ocrPdfPages(document);
        }
    }

    private String ocrPdfPages(PDDocument document) throws IOException {
        PDFRenderer renderer = new PDFRenderer(document);
        int pages = Math.min(document.getNumberOfPages(), MAX_PDF_PAGES_OCR);
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < pages; i++) {
            BufferedImage image = renderer.renderImageWithDPI(i, 200);
            try {
                sb.append(ocrImage(image)).append('\n');
            } catch (TesseractException e) {
                log.warn("OCR failed on PDF page {}: {}", i + 1, e.getMessage());
            }
        }
        return sb.toString();
    }

    private String ocrImageBytes(byte[] bytes) throws IOException {
        try (InputStream in = new ByteArrayInputStream(bytes)) {
            BufferedImage image = ImageIO.read(in);
            if (image == null) {
                throw new IllegalArgumentException("Could not read image file");
            }
            return ocrImage(image);
        } catch (TesseractException e) {
            throw new IllegalArgumentException("OCR failed: " + e.getMessage());
        }
    }

    private String ocrImage(BufferedImage image) throws TesseractException {
        ITesseract tesseract = new Tesseract();
        tesseract.setDatapath(tessDataPath);
        tesseract.setLanguage("eng");
        tesseract.setPageSegMode(1);
        return tesseract.doOCR(image);
    }
}
