package com.auth.controller;

import com.auth.repository.AppUserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;
import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/db")
public class HealthController {

    private final AppUserRepository appUserRepository;

    public HealthController(AppUserRepository appUserRepository) {
        this.appUserRepository = appUserRepository;
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        try {
            long adminCount = appUserRepository.findByRoleOrderByIdAsc("ADMIN").size();
            long biometricCount = appUserRepository.findAll().stream().filter(u -> u.getFaceDescriptor() != null).count();
            
            // Try to reach book-service for book count
            long booksCount = 0;
            try {
                RestTemplate restTemplate = new RestTemplate();
                java.util.List<?> books = restTemplate.getForObject("http://localhost:8082/api/books", java.util.List.class);
                if (books != null) booksCount = books.size();
            } catch (Exception e) {}

            Map<String, Object> tables = new HashMap<>();
            tables.put("admin_users", adminCount);
            tables.put("biometric_users", biometricCount);
            tables.put("booksaved", booksCount);

            Map<String, Object> response = new HashMap<>();
            response.put("status", "CONNECTED");
            response.put("database", "farmo_ai_db");
            response.put("host", "localhost");
            response.put("port", 3306);
            response.put("user", "farmer");
            response.put("tables", tables);
            response.put("timestamp", LocalDateTime.now().toString());

            return ResponseEntity.ok(response);
        } catch (Exception err) {
            Map<String, Object> errRes = new HashMap<>();
            errRes.put("status", "DISCONNECTED");
            errRes.put("error", err.getMessage());
            return ResponseEntity.status(500).body(errRes);
        }
    }
}
