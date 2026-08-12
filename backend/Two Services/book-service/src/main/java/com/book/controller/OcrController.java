package com.book.controller;

import com.book.dto.OcrResponse;
import com.book.service.OcrService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/ocr")
public class OcrController {

    @Autowired
    private OcrService ocrService;

    @PostMapping("/extract")
    public ResponseEntity<OcrResponse> extractText(@RequestParam("file") MultipartFile file) {
        long startTime = System.currentTimeMillis();
        try {
            if (file == null || file.isEmpty()) {
                return ResponseEntity.badRequest().body(new OcrResponse(false, "", "No image file provided.", 0));
            }
            String text = ocrService.extractTextFromImage(file);
            long processingTime = System.currentTimeMillis() - startTime;
            return ResponseEntity.ok(new OcrResponse(true, text != null ? text.trim() : "", processingTime));
        } catch (Exception e) {
            long processingTime = System.currentTimeMillis() - startTime;
            return ResponseEntity.status(500).body(new OcrResponse(false, "", "Error: " + e.getMessage(), processingTime));
        }
    }
}
