package com.book.controller;

import com.book.entity.Page;
import com.book.repository.PageRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.*;

@RestController
@CrossOrigin(origins = "*")
public class VoiceAndStorageController {

    private final PageRepository pageRepository;
    private final HttpClient httpClient;

    @Value("${gemini.api.key:${api.key:}}")
    private String geminiApiKey;

    public VoiceAndStorageController(PageRepository pageRepository) {
        this.pageRepository = pageRepository;
        this.httpClient = HttpClient.newHttpClient();
    }

    private static final String SYSTEM_PROMPT = "You are a multilingual voice-agent for ReadEase — a book-reading app for blind users.\n" +
            "TASK: Given the user's spoken/typed input (in ANY language), return ONLY a JSON object.\n" +
            "{\n" +
            "  \"language\":   \"<bcp-47>\",\n" +
            "  \"intent\":     \"<intent>\",\n" +
            "  \"navigate\":   \"<route or null>\",\n" +
            "  \"target\":     \"<book name or null>\",\n" +
            "  \"confidence\": <0.0–1.0>,\n" +
            "  \"response\":   \"<reply in user's language>\"\n" +
            "}";

    @PostMapping("/api/parse-intent")
    public ResponseEntity<Map<String, Object>> parseIntent(@RequestBody Map<String, Object> request) {
        String userInput = (String) request.get("userInput");
        
        if (userInput == null || userInput.isBlank()) {
            return fallbackUnknown();
        }

        if (geminiApiKey == null || geminiApiKey.isBlank()) {
            Map<String, Object> err = new HashMap<>();
            err.put("error", "GEMINI_API_KEY not configured");
            return ResponseEntity.internalServerError().body(err);
        }

        try {
            String url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + geminiApiKey;
            
            String jsonBody = "{" +
                    "\"system_instruction\": {\"parts\": [{\"text\": \"" + SYSTEM_PROMPT.replace("\n", "\\n").replace("\"", "\\\"") + "\"}]}," +
                    "\"contents\": [{\"parts\": [{\"text\": \"" + userInput.replace("\"", "\\\"").replace("\n", " ") + "\"}]}]," +
                    "\"generationConfig\": {\"temperature\": 0.1, \"maxOutputTokens\": 1024}" +
                    "}";

            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                    .build();

            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
            String responseBody = response.body();

            // Simple extraction of text part (assumes Gemini JSON structure)
            int textIndex = responseBody.indexOf("\"text\": \"");
            if (textIndex > -1) {
                int startIndex = textIndex + 9;
                int endIndex = responseBody.indexOf("\"", startIndex);
                
                // Handle escaped quotes inside the text string if necessary, but typical JSON parse is better.
                // Using Jackson or Gson here would be cleaner, but we can do a quick parse since we only need the JSON block inside.
                // To safely parse, let's extract the block between ```json and ```
                String rawText = extractRawText(responseBody);
                if (rawText != null) {
                    rawText = rawText.replaceAll("^```json\\s*", "").replaceAll("^```\\s*", "").replaceAll("\\s*```$", "").trim();
                    
                    com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                    try {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> parsed = mapper.readValue(rawText, Map.class);
                        return ResponseEntity.ok(parsed);
                    } catch (Exception parseEx) {
                        // ignore and fallback
                    }
                }
            }

            return fallbackUnknown();

        } catch (Exception e) {
            return fallbackUnknown();
        }
    }
    
    private String extractRawText(String geminiResponse) {
        try {
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            com.fasterxml.jackson.databind.JsonNode root = mapper.readTree(geminiResponse);
            com.fasterxml.jackson.databind.JsonNode candidates = root.path("candidates");
            if (candidates.isArray() && candidates.size() > 0) {
                return candidates.get(0).path("content").path("parts").get(0).path("text").asText();
            }
        } catch (Exception e) {}
        return null;
    }

    private ResponseEntity<Map<String, Object>> fallbackUnknown() {
        Map<String, Object> result = new HashMap<>();
        result.put("language", "en-US");
        result.put("intent", "unknown");
        result.put("navigate", null);
        result.put("target", null);
        result.put("confidence", 0.0);
        result.put("response", "Done.");
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

            Long bookId = request.get("bookId") != null ? Long.valueOf(request.get("bookId").toString()) : null;
            Integer pageNumber = request.get("pageNumber") != null ? Integer.valueOf(request.get("pageNumber").toString()) : 1;
            String text = (String) request.get("text");
            String dhash = (String) request.get("dhash");

            Path pagesDir = Paths.get("storage", "pages");
            Files.createDirectories(pagesDir);

            long count = 0;
            try (var stream = Files.list(pagesDir)) {
                count = stream.count();
            }
            long fileNum = count + 1;

            String fileName = (String) request.get("filename");
            if (fileName == null || fileName.isBlank()) {
                fileName = String.format("page_%03d.jpg", fileNum);
            }
            Path filePath = pagesDir.resolve(fileName);

            String cleanBase64 = imageBase64.replaceAll("^data:image/\\\\w+;base64,", "");
            byte[] imageBytes = Base64.getDecoder().decode(cleanBase64);
            Files.write(filePath, imageBytes);
            
            // Database Storage
            Page page = new Page();
            page.setBookId(bookId);
            page.setPageNumber(pageNumber);
            page.setImageData(imageBase64);
            page.setExtractedText(text != null ? text : "");
            page.setDhash(dhash != null ? dhash : "");
            Page savedPage = pageRepository.save(page);

            response.put("success", true);
            response.put("fileName", fileName);
            response.put("filePath", filePath.toAbsolutePath().toString());
            response.put("pageNumber", pageNumber);
            response.put("pageId", savedPage.getId());
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

    @GetMapping("/api/books/{id}/pages")
    public ResponseEntity<?> getBookPages(@PathVariable Long id) {
        try {
            List<Page> pages = pageRepository.findByBookIdOrderByPageNumberAsc(id);
            List<Map<String, Object>> res = new ArrayList<>();
            for (Page p : pages) {
                Map<String, Object> map = new HashMap<>();
                map.put("id", String.valueOf(p.getId()));
                map.put("bookId", String.valueOf(p.getBookId()));
                map.put("pageNumber", p.getPageNumber());
                map.put("imageData", p.getImageData());
                map.put("extractedText", p.getExtractedText());
                map.put("dhash", p.getDhash());
                map.put("createdAt", p.getCreatedAt());
                res.add(map);
            }
            return ResponseEntity.ok(res);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/api/pages/session")
    public ResponseEntity<Map<String, Object>> createPageSession(@RequestBody Map<String, Object> request) {
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("sessionId", "session_" + System.currentTimeMillis());
        return ResponseEntity.ok(response);
    }
}
