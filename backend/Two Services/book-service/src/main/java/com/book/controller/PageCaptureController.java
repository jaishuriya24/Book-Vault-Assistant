package com.book.controller;

import com.book.dto.CaptureRequest;
import com.book.dto.CaptureResponse;
import com.book.service.TextDetectorService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/books")
@CrossOrigin(origins = "*")
public class PageCaptureController {

    private final TextDetectorService textDetectorService;

    public PageCaptureController(TextDetectorService textDetectorService) {
        this.textDetectorService = textDetectorService;
    }

    @GetMapping("/detector-status")
    public ResponseEntity<Map<String, Object>> getDetectorStatus() {
        Map<String, Object> status = textDetectorService.checkStatus();
        return ResponseEntity.ok(status);
    }

    @PostMapping("/capture")
    public ResponseEntity<CaptureResponse> capturePage(@Valid @RequestBody CaptureRequest request) {
        return textDetectorService.capturePage(request);
    }

    @PostMapping("/webcam-capture")
    public ResponseEntity<Map<String, String>> captureFromWebcam() {
        Map<String, String> response = new java.util.HashMap<>();
        try {
            com.github.sarxos.webcam.Webcam webcam = com.github.sarxos.webcam.Webcam.getDefault();
            if (webcam != null) {
                if (!webcam.isOpen()) {
                    webcam.open();
                }
                java.awt.image.BufferedImage img = webcam.getImage();
                webcam.close();

                java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
                javax.imageio.ImageIO.write(img, "jpg", baos);
                String base64 = java.util.Base64.getEncoder().encodeToString(baos.toByteArray());
                String dataUrl = "data:image/jpeg;base64," + base64;

                response.put("status", "SUCCESS");
                response.put("capturedImage", dataUrl);
                return ResponseEntity.ok(response);
            } else {
                response.put("status", "ERROR");
                response.put("message", "No webcam detected");
                return ResponseEntity.badRequest().body(response);
            }
        } catch (Exception e) {
            response.put("status", "ERROR");
            response.put("message", e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }
}

