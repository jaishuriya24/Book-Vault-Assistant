package com.auth.controller;

import com.auth.dto.*;
import com.auth.entity.AdminUser;
import com.auth.entity.AppUser;
import com.auth.entity.LoginHistory;
import com.auth.entity.Role;
import com.auth.repository.AdminUserRepository;
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
    private final AdminUserRepository adminUserRepository;
    private final LoginHistoryRepository loginHistoryRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtUtil jwtUtil;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public AuthController(AppUserRepository appUserRepository,
                          AdminUserRepository adminUserRepository,
                          LoginHistoryRepository loginHistoryRepository,
                          PasswordEncoder passwordEncoder,
                          AuthenticationManager authenticationManager,
                          JwtUtil jwtUtil) {
        this.appUserRepository = appUserRepository;
        this.adminUserRepository = adminUserRepository;
        this.loginHistoryRepository = loginHistoryRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.jwtUtil = jwtUtil;
    }

    /**
     * Creates a new user in MySQL.
     */
    /**
     * Creates a new user in MySQL and saves optional face biometric descriptor.
     */
    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest request) {
        if (appUserRepository.existsByEmail(request.getEmail())) {
            return ResponseEntity.badRequest().body("Email already registered");
        }

        String requestedRole = request.getRole() == null || request.getRole().isBlank()
                ? Role.READER.name()
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

        // Save facial biometric descriptor as standardized multi-sample array if captured during sign up
        if (request.getFaceDescriptor() != null) {
            try {
                List<List<Double>> samples = parseDescriptorSamples(objectMapper.writeValueAsString(request.getFaceDescriptor()));
                user.setFaceDescriptor(objectMapper.writeValueAsString(samples));
            } catch (Exception e) {
                System.err.println("Failed to serialize faceDescriptor on register: " + e.getMessage());
            }
        }

        appUserRepository.save(user);
        String token = jwtUtil.generateToken(user.getEmail(), user.getId(), user.getRole());

        // Return structured JSON response with token & details
        java.util.Map<String, Object> resp = new java.util.HashMap<>();
        resp.put("success", true);
        resp.put("message", "User registered successfully");
        resp.put("id", user.getId());
        resp.put("name", user.getName());
        resp.put("email", user.getEmail());
        resp.put("role", user.getRole());
        resp.put("token", token);

        return ResponseEntity.ok(resp);
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
     * Dedicated Admin login endpoint querying admin_users table strictly.
     */
    @PostMapping("/admin/login")
    public ResponseEntity<?> adminLogin(@Valid @RequestBody AdminLoginRequest request) {
        String identifier = request.getUsernameOrEmail().trim();
        AdminUser admin = adminUserRepository.findByUsernameOrEmail(identifier, identifier).orElse(null);

        if (admin != null) {
            boolean matches = passwordEncoder.matches(request.getPassword(), admin.getPassword())
                    || request.getPassword().equals(admin.getPassword());

            if (matches) {
                loginHistoryRepository.save(new LoginHistory(
                        admin.getId(), admin.getEmail(), admin.getUsername(), "ADMIN_PASSWORD", "SUCCESS", 0.0, "Admin authenticated"));
                String token = jwtUtil.generateToken(admin.getEmail(), admin.getId(), "ADMIN");
                return ResponseEntity.ok(new AuthResponse(token, admin.getId(), admin.getEmail(), admin.getUsername(), "ADMIN"));
            }
        }

        loginHistoryRepository.save(new LoginHistory(
                null, identifier, "UNKNOWN", "ADMIN_PASSWORD", "FAILED", null, "Invalid admin credentials"));
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid admin credentials");
    }

    /**
     * Associates or registers a new face biometric descriptor with a user in MySQL.
     * 🛡️ STRICT SECURITY GATE:
     * - Unauthenticated requests ALWAYS create a new, isolated AppUser row (never merges across unauthenticated users).
     * - Merging/updating existing account face descriptors requires a valid Bearer JWT Authorization header.
     */
    @PostMapping("/face-register")
    public ResponseEntity<?> registerFace(@RequestHeader(value = "Authorization", required = false) String authHeader,
                                          @RequestBody FaceRegisterRequest request) {
        String displayName = (request.getName() != null && !request.getName().isBlank())
                ? request.getName().trim()
                : "Reader";

        if (request.getFaceDescriptor() == null || request.getFaceDescriptor().isEmpty()) {
            return ResponseEntity.badRequest().body("Non-empty face descriptor vector is required.");
        }

        AppUser user = null;

        // 🔒 SECURITY GATE: Verify if caller holds a valid JWT token for an existing session
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            try {
                String tokenEmail = jwtUtil.extractUsername(token);
                if (tokenEmail != null && !tokenEmail.isBlank()) {
                    user = appUserRepository.findByEmail(tokenEmail).orElse(null);
                }
            } catch (Exception e) {
                // Invalid token — treat as unauthenticated
            }
        }

        // 🛡️ UNAUTHENTICATED BRANCH: Always isolate into a fresh AppUser row!
        if (user == null) {
            String uniqueSystemEmail = displayName.toLowerCase().replaceAll("\\s+", "") 
                    + "_" + java.util.UUID.randomUUID().toString().substring(0, 8) + "@readease.vault";
            
            user = new AppUser();
            user.setEmail(uniqueSystemEmail);
            user.setName(displayName);
            user.setPassword("face_biometric_auth");
            user.setRole(Role.READER.name());
        } else {
            // AUTHENTICATED RE-ENROLLMENT BRANCH: Update display name for authenticated user
            user.setName(displayName);
        }

        try {
            // Merge face samples into multi-sample vector array
            List<List<Double>> existingSamples = parseDescriptorSamples(user.getFaceDescriptor());
            List<List<Double>> newSamples = parseDescriptorSamples(objectMapper.writeValueAsString(request.getFaceDescriptor()));

            List<List<Double>> merged = new java.util.ArrayList<>(existingSamples);
            for (List<Double> s : newSamples) {
                if (s != null && s.size() == 128) {
                    merged.add(s);
                }
            }
            // Keep up to 10 latest high-quality sample vectors
            if (merged.size() > 10) {
                merged = merged.subList(merged.size() - 10, merged.size());
            }

            String descriptorJson = objectMapper.writeValueAsString(merged);
            user.setFaceDescriptor(descriptorJson);
            appUserRepository.save(user);

            String token = jwtUtil.generateToken(user.getEmail(), user.getId(), user.getRole());
            return ResponseEntity.ok(new AuthResponse(
                    token,
                    user.getId(),
                    user.getEmail(),
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
        // Calibrated Euclidean Distance threshold for 128-D ResNet descriptors
        double MATCH_THRESHOLD = 0.45;

        for (AppUser user : allUsers) {
            if (user.getFaceDescriptor() == null || user.getFaceDescriptor().isBlank()) {
                continue;
            }

            try {
                // Support both single 128-D vector [128] and multi-sample array [[128], [128], ...]
                List<List<Double>> samples = parseDescriptorSamples(user.getFaceDescriptor());
                for (List<Double> storedVector : samples) {
                    if (storedVector == null || storedVector.size() != 128) continue; // Purge non-128 legacy vectors

                    double dist = calculateEuclideanDistance(request.getFaceDescriptor(), storedVector);
                    if (dist < minDistance) {
                        minDistance = dist;
                        bestMatchUser = user;
                    }
                }
            } catch (Exception ignored) {
            }
        }

        if (bestMatchUser != null && minDistance <= MATCH_THRESHOLD) {
            // Save successful face login in MySQL with user NAME and READER role
            loginHistoryRepository.save(new LoginHistory(
                    bestMatchUser.getId(),
                    bestMatchUser.getEmail(),
                    bestMatchUser.getName(),
                    "FACE_RECOGNITION",
                    "SUCCESS",
                    minDistance,
                    "Face match distance: " + String.format("%.4f", minDistance)));

            // Strictly issue token as READER for biometric logins
            String token = jwtUtil.generateToken(bestMatchUser.getEmail(), bestMatchUser.getId(), "READER");
            return ResponseEntity.ok(new AuthResponse(
                    token,
                    bestMatchUser.getId(),
                    bestMatchUser.getEmail(),
                    bestMatchUser.getName(),
                    "READER"));
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
     * Helper to parse face descriptors stored as either [128] single vector or [[128], [128]] multi-sample array.
     */
    private List<List<Double>> parseDescriptorSamples(String rawJson) {
        List<List<Double>> samples = new java.util.ArrayList<>();
        if (rawJson == null || rawJson.isBlank()) return samples;

        try {
            if (rawJson.trim().startsWith("[[")) {
                samples = objectMapper.readValue(rawJson, new TypeReference<List<List<Double>>>() {});
            } else {
                List<Double> single = objectMapper.readValue(rawJson, new TypeReference<List<Double>>() {});
                if (single != null) samples.add(single);
            }
        } catch (Exception e) {
        }
        return samples;
    }

    /**
     * Calculates true Euclidean Distance between two 128-dimensional feature vectors: sqrt(sum((a_i - b_i)^2))
     * Returns a distance value between 0.0 (identical) and ~1.5 (different).
     */
    private double calculateEuclideanDistance(List<Double> v1, List<Double> v2) {
        if (v1 == null || v2 == null) return Double.MAX_VALUE;
        int len = Math.min(v1.size(), v2.size());
        if (len == 0) return Double.MAX_VALUE;
        double sum = 0.0;
        for (int i = 0; i < len; i++) {
            double a = v1.get(i) != null ? v1.get(i) : 0.0;
            double b = v2.get(i) != null ? v2.get(i) : 0.0;
            double diff = a - b;
            sum += diff * diff;
        }
        return Math.sqrt(sum);
    }
}
