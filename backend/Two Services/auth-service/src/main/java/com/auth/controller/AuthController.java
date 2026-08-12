package com.auth.controller;

import com.auth.dto.*;
import com.auth.entity.AppUser;
import com.auth.entity.LoginHistory;
import com.auth.entity.Role;
import com.auth.repository.AppUserRepository;
import com.auth.repository.LoginHistoryRepository;
import com.auth.security.JwtUtil;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AppUserRepository appUserRepository;
    private final LoginHistoryRepository loginHistoryRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtUtil jwtUtil;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public AuthController(AppUserRepository appUserRepository,
                          LoginHistoryRepository loginHistoryRepository,
                          PasswordEncoder passwordEncoder,
                          AuthenticationManager authenticationManager,
                          JwtUtil jwtUtil) {
        this.appUserRepository = appUserRepository;
        this.loginHistoryRepository = loginHistoryRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.jwtUtil = jwtUtil;
    }

    /**
     * Creates a new user in MySQL.
     */
    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest request) {
        if (appUserRepository.existsByEmail(request.getEmail())) {
            return ResponseEntity.badRequest().body("Email already registered");
        }

        String requestedRole = request.getRole() == null || request.getRole().isBlank()
                ? Role.EMPLOYEE.name()
                : request.getRole().trim().toUpperCase();

        boolean validRole = Arrays.stream(Role.values())
                .anyMatch(role -> role.name().equals(requestedRole));
        if (!validRole) {
            return ResponseEntity.badRequest().body(
                    "Invalid role. Must be one of: " + Arrays.toString(Role.values()));
        }

        AppUser user = new AppUser();
        user.setName(request.getName());
        user.setEmail(request.getEmail());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRole(requestedRole);
        appUserRepository.save(user);

        return ResponseEntity.ok("User registered successfully");
    }

    /**
     * Verifies email/password, issues a JWT, and logs the login in MySQL.
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword()));

            AppUser user = appUserRepository.findByEmail(request.getEmail()).orElseThrow();

            // Save login history to MySQL (includes user NAME for display in table)
            loginHistoryRepository.save(new LoginHistory(
                    user.getId(), user.getEmail(), user.getName(), "PASSWORD", "SUCCESS", 0.0, "Password authenticated"));

            String token = jwtUtil.generateToken(user.getEmail(), user.getId(), user.getRole());
            return ResponseEntity.ok(new AuthResponse(token, user.getId(), user.getEmail(), user.getName(), user.getRole()));
        } catch (Exception e) {
            loginHistoryRepository.save(new LoginHistory(
                    null, request.getEmail(), "UNKNOWN", "PASSWORD", "FAILED", null, "Invalid credentials"));
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid credentials");
        }
    }

    /**
     * Associates or registers a new face biometric descriptor with a user in MySQL.
     * If the user is new, automatically creates the user record in MySQL.
     */
    @PostMapping("/face-register")
    public ResponseEntity<?> registerFace(@RequestBody FaceRegisterRequest request) {
        // Name is mandatory — this is what shows in the APP_USERS table
        String displayName = (request.getName() != null && !request.getName().isBlank())
                ? request.getName().trim()
                : null;

        if (displayName == null || request.getFaceDescriptor() == null || request.getFaceDescriptor().isEmpty()) {
            return ResponseEntity.badRequest().body("Name and non-empty face descriptor are required");
        }

        // Generate a hidden internal system email from the display name
        // e.g. "Enrolled Reader" → "enrolledreader@readease.vault"
        String systemEmail = displayName.toLowerCase().replaceAll("\\s+", "") + "@readease.vault";
        // Prefer an explicit real email if it was provided (and isn't just the name repeated)
        if (request.getEmail() != null && request.getEmail().contains("@") && !request.getEmail().equalsIgnoreCase(displayName)) {
            systemEmail = request.getEmail().trim();
        }

        AppUser user = appUserRepository.findByEmail(systemEmail).orElse(null);

        // If new user, create record in MySQL with READER role
        if (user == null) {
            user = new AppUser();
            user.setEmail(systemEmail); // internal only, never shown to user
            user.setPassword("face_biometric_auth");
            user.setRole(Role.READER.name());
        }
        // Always update the display NAME (shown in table)
        user.setName(displayName);
        // Keep ADMIN role if already set; upgrade USER/EMPLOYEE → READER
        if (user.getRole() == null || user.getRole().equals("USER") || user.getRole().equals("EMPLOYEE")) {
            user.setRole(Role.READER.name());
        }

        try {
            String descriptorJson = objectMapper.writeValueAsString(request.getFaceDescriptor());
            user.setFaceDescriptor(descriptorJson);
            appUserRepository.save(user);

            // Return NAME and ROLE only — email is internal, never exposed
            return ResponseEntity.ok(new AuthResponse(
                    null,
                    user.getId(),
                    null,
                    user.getName(),
                    user.getRole()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Failed to save face descriptor: " + e.getMessage());
        }
    }

    /**
     * Face Recognition Login specifically designed for blind users & readers.
     * Matches the webcam face descriptor vector against all registered faces in MySQL.
     * Records the login event in MySQL LOGIN_HISTORY.
     */
    @PostMapping("/face-login")
    public ResponseEntity<?> faceLogin(@RequestBody FaceLoginRequest request) {
        if (request.getFaceDescriptor() == null || request.getFaceDescriptor().isEmpty()) {
            return ResponseEntity.badRequest().body("Face descriptor vector is required.");
        }

        List<AppUser> allUsers = appUserRepository.findAll();
        AppUser bestMatchUser = null;
        double minDistance = Double.MAX_VALUE;
        // Calibrated Cosine Distance threshold for 128-D normalized vectors (<= 0.22 is same person)
        double MATCH_THRESHOLD = 0.22;

        for (AppUser user : allUsers) {
            if (user.getFaceDescriptor() == null || user.getFaceDescriptor().isBlank()) {
                continue;
            }

            try {
                List<Double> storedVector = objectMapper.readValue(
                        user.getFaceDescriptor(), new TypeReference<List<Double>>() {});

                double dist = calculateCosineDistance(request.getFaceDescriptor(), storedVector);
                if (dist < minDistance) {
                    minDistance = dist;
                    bestMatchUser = user;
                }
            } catch (Exception ignored) {
            }
        }

        if (bestMatchUser != null && minDistance <= MATCH_THRESHOLD) {
            // Save successful face login in MySQL with user NAME and ROLE
            loginHistoryRepository.save(new LoginHistory(
                    bestMatchUser.getId(),
                    bestMatchUser.getEmail(),
                    bestMatchUser.getName(),
                    "FACE_RECOGNITION",
                    "SUCCESS",
                    minDistance,
                    "Face match distance: " + String.format("%.4f", minDistance)));

            String token = jwtUtil.generateToken(bestMatchUser.getEmail(), bestMatchUser.getId(), bestMatchUser.getRole());
            return ResponseEntity.ok(new AuthResponse(
                    token,
                    bestMatchUser.getId(),
                    bestMatchUser.getEmail(),
                    bestMatchUser.getName(),
                    bestMatchUser.getRole()));
        } else {
            // Save failed login attempt in MySQL
            loginHistoryRepository.save(new LoginHistory(
                    null,
                    "UNKNOWN",
                    "UNKNOWN",
                    "FACE_RECOGNITION",
                    "FAILED",
                    minDistance == Double.MAX_VALUE ? null : minDistance,
                    "Face distance above threshold: " + (minDistance == Double.MAX_VALUE ? "N/A" : String.format("%.4f", minDistance))));

            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body("Face not recognized. Please center your face or use voice / password login.");
        }
    }

    /**
     * Retrieve recent login history logs from MySQL.
     */
    @GetMapping("/login-history")
    public ResponseEntity<List<LoginHistory>> getLoginHistory() {
        return ResponseEntity.ok(loginHistoryRepository.findTop50ByOrderByLoginTimeDesc());
    }

    /**
     * Calculates Cosine Distance between two 128-dimensional feature vectors.
     * Returns a distance value between 0.0 (identical) and 1.0 (different).
     */
    private double calculateCosineDistance(List<Double> v1, List<Double> v2) {
        if (v1 == null || v2 == null) return Double.MAX_VALUE;
        int len = Math.min(v1.size(), v2.size());
        if (len == 0) return Double.MAX_VALUE;
        double dot = 0.0;
        double mag1 = 0.0;
        double mag2 = 0.0;
        for (int i = 0; i < len; i++) {
            double a = v1.get(i) != null ? v1.get(i) : 0.0;
            double b = v2.get(i) != null ? v2.get(i) : 0.0;
            dot += a * b;
            mag1 += a * a;
            mag2 += b * b;
        }
        double denom = Math.sqrt(mag1) * Math.sqrt(mag2);
        if (denom == 0.0) return Double.MAX_VALUE;
        double sim = dot / denom;
        return Math.max(0.0, 1.0 - sim);
    }
}
