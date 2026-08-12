package com.book.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;

@RestController
@CrossOrigin(origins = "*")
public class VoiceAndStorageController {

    @PostMapping("/api/parse-intent")
    public ResponseEntity<Map<String, Object>> parseIntent(@RequestBody Map<String, Object> request) {
        String userInput = (String) request.get("userInput");
        Map<String, Object> result = new HashMap<>();

        if (userInput == null || userInput.isBlank()) {
            result.put("action", "unknown");
            result.put("target", null);
            return ResponseEntity.ok(result);
        }

        String input = userInput.toLowerCase().trim();

        if (input.contains("search") || input.contains("find") || input.contains("read") || input.contains("open book")) {
            result.put("action", "search_book");
            String target = input.replaceAll("(?i).*(search|find|read|open book)\\s*", "").trim();
            result.put("target", target.isEmpty() ? "Book" : target);
        } else if (input.contains("camera") || input.contains("scan a book") || input.contains("open camera") || input.contains("upload")) {
            result.put("action", "open_camera");
            result.put("target", null);
        } else if (input.contains("capture") || input.contains("take picture") || input.contains("scan now")) {
            result.put("action", "capture_scan");
            result.put("target", null);
        } else if (input.contains("pause") || input.contains("stop")) {
            result.put("action", "pause");
            result.put("target", null);
        } else if (input.contains("continue") || input.contains("resume")) {
            result.put("action", "resume");
            result.put("target", null);
        } else if (input.contains("repeat") || input.contains("what book")) {
            result.put("action", "repeat");
            result.put("target", null);
        } else if (input.contains("login") || input.contains("admin")) {
            result.put("action", "login");
            result.put("target", null);
        } else {
            result.put("action", "unknown");
            result.put("target", null);
        }

        return ResponseEntity.ok(result);
    }

    @PostMapping("/api/save-page")
    public ResponseEntity<Map<String, Object>> savePage(@RequestBody Map<String, Object> request) {
        Map<String, Object> response = new HashMap<>();
        try {
            String imageBase64 = (String) request.get("imageBase64");

            if (imageBase64 == null || imageBase64.isBlank()) {
                response.put("error", "No imageBase64 provided");
                return ResponseEntity.badRequest().body(response);
            }

            Path pagesDir = Paths.get("storage", "pages");
            Files.createDirectories(pagesDir);

            long count = 0;
            try (var stream = Files.list(pagesDir)) {
                count = stream.count();
            }
            long pageNum = count + 1;

            String fileName = (String) request.get("filename");
            if (fileName == null || fileName.isBlank()) {
                fileName = String.format("page_%03d.jpg", pageNum);
            }
            Path filePath = pagesDir.resolve(fileName);

            String cleanBase64 = imageBase64.replaceAll("^data:image/\\w+;base64,", "");
            byte[] imageBytes = Base64.getDecoder().decode(cleanBase64);
            Files.write(filePath, imageBytes);

            response.put("success", true);
            response.put("fileName", fileName);
            response.put("filePath", filePath.toAbsolutePath().toString());
            response.put("pageNumber", pageNum);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            response.put("error", e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }

    @PostMapping("/api/books/convert-objects")
    public ResponseEntity<Map<String, Object>> convertObjects(@RequestBody Map<String, Object> request) {
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Objects converted successfully");
        response.put("converted", request.getOrDefault("predictions", List.of()));
        return ResponseEntity.ok(response);
    }
}
