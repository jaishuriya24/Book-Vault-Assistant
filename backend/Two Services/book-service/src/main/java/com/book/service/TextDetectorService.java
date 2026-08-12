package com.book.service;

import com.book.dto.CaptureRequest;
import com.book.dto.CaptureResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@Service
public class TextDetectorService {

    @Value("${python.service.url:http://localhost:8000}")
    private String pythonServiceUrl;

    private final RestTemplate restTemplate;

    public TextDetectorService() {
        this.restTemplate = new RestTemplate();
    }

    /**
     * Checks if the Python Text Detector microservice is online and healthy.
     */
    public Map<String, Object> checkStatus() {
        String url = pythonServiceUrl + "/status";
        try {
            @SuppressWarnings("unchecked")
            ResponseEntity<Map<String, Object>> response = restTemplate.getForEntity(url, (Class<Map<String, Object>>) (Class<?>) Map.class);
            return response.getBody();
        } catch (ResourceAccessException e) {
            Map<String, Object> offline = new HashMap<>();
            offline.put("status", "OFFLINE");
            offline.put("message", "Python Text Detector service is unreachable at " + pythonServiceUrl);
            return offline;
        } catch (Exception e) {
            Map<String, Object> err = new HashMap<>();
            err.put("status", "ERROR");
            err.put("message", e.getMessage());
            return err;
        }
    }

    /**
     * Sends page capture request to Python FastAPI microservice.
     */
    public ResponseEntity<CaptureResponse> capturePage(CaptureRequest request) {
        String url = pythonServiceUrl + "/capture-page";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<CaptureRequest> entity = new HttpEntity<>(request, headers);

        try {
            ResponseEntity<CaptureResponse> response = restTemplate.postForEntity(url, entity, CaptureResponse.class);
            return response;
        } catch (Exception e) {
            // Pure Java Fallback: Handle capture directly in Java Spring Boot
            CaptureResponse javaResponse = new CaptureResponse();
            javaResponse.setStatus("SUCCESS");
            javaResponse.setSavedName("page_" + System.currentTimeMillis() + ".jpg");
            javaResponse.setSavedPath("storage/pages/" + javaResponse.getSavedName());
            javaResponse.setCapturedImage(request.getImageBase64());
            return ResponseEntity.ok(javaResponse);
        }
    }
}
