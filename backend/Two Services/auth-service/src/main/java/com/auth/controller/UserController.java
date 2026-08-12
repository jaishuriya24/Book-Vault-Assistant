package com.auth.controller;

import com.auth.dto.UserProfileResponse;
import com.auth.entity.AppUser;
import com.auth.entity.LoginHistory;
import com.auth.repository.AppUserRepository;
import com.auth.repository.LoginHistoryRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final AppUserRepository appUserRepository;
    private final LoginHistoryRepository loginHistoryRepository;

    public UserController(AppUserRepository appUserRepository,
                          LoginHistoryRepository loginHistoryRepository) {
        this.appUserRepository = appUserRepository;
        this.loginHistoryRepository = loginHistoryRepository;
    }

    /** Current logged-in user profile */
    @GetMapping("/me")
    public ResponseEntity<?> me(@AuthenticationPrincipal Object principal) {
        try {
            String email = null;
            if (principal instanceof UserDetails userDetails) {
                email = userDetails.getUsername();
            } else if (principal instanceof String strPrincipal && !"anonymousUser".equals(strPrincipal)) {
                email = strPrincipal;
            }
            if (email == null || email.isBlank()) {
                Authentication auth = SecurityContextHolder.getContext().getAuthentication();
                if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
                    email = auth.getName();
                }
            }
            if (email == null || email.isBlank() || "anonymousUser".equals(email)) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Missing or invalid token"));
            }
            AppUser user = appUserRepository.findByEmail(email).orElse(null);
            if (user == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "User not found"));
            }
            return ResponseEntity.ok(new UserProfileResponse(user.getId(), user.getName(), user.getEmail(), user.getRole()));
        } catch (Exception e) {
            Map<String, Object> err = new HashMap<>();
            err.put("error", e.getClass().getName() + ": " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(err);
        }
    }

    /**
     * TABLE 1 — Reader / User Table
     * Returns READER users: USER_ID, USER_NAME, Role, hasBiometric
     * GET /api/users/readers
     */
    @GetMapping("/readers")
    public ResponseEntity<?> getReaderUsers() {
        List<AppUser> readers = appUserRepository.findByRoleInOrderByIdAsc(
                List.of("READER", "USER", "EMPLOYEE"));

        List<Map<String, Object>> result = readers.stream().map(u -> {
            Map<String, Object> row = new HashMap<>();
            row.put("userId", u.getId());
            row.put("userName", u.getName());
            row.put("role", u.getRole());
            row.put("hasBiometric", u.getFaceDescriptor() != null && !u.getFaceDescriptor().isBlank());
            return row;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    /**
     * TABLE 2 — Admin Login History Table
     * Returns login events for ADMIN users: USER_NAME, EMAIL, USER_ID, LOGIN_TIME, STATUS
     * GET /api/users/admin-logins
     */
    @GetMapping("/admin-logins")
    public ResponseEntity<?> getAdminLoginHistory() {
        // Get all admin users
        List<AppUser> admins = appUserRepository.findByRoleOrderByIdAsc("ADMIN");
        List<Long> adminIds = admins.stream().map(AppUser::getId).collect(Collectors.toList());

        // Build a quick lookup map: id -> AppUser
        Map<Long, AppUser> adminMap = admins.stream()
                .collect(Collectors.toMap(AppUser::getId, u -> u));

        // Get login history for admins (fall back to all recent logs if no admins yet)
        List<LoginHistory> history = adminIds.isEmpty()
                ? loginHistoryRepository.findTop100ByOrderByLoginTimeDesc()
                : loginHistoryRepository.findByUserIdInOrderByLoginTimeDesc(adminIds);

        List<Map<String, Object>> result = history.stream().map(log -> {
            Map<String, Object> row = new HashMap<>();
            row.put("logId", log.getId());
            row.put("userId", log.getUserId());
            row.put("userName", log.getUserName() != null ? log.getUserName() : "Unknown");
            AppUser admin = log.getUserId() != null ? adminMap.get(log.getUserId()) : null;
            row.put("email", admin != null ? admin.getEmail() : log.getUserEmail());
            row.put("loginTime", log.getLoginTime());
            row.put("authMethod", log.getAuthMethod());
            row.put("status", log.getStatus());
            row.put("matchDistance", log.getMatchDistance());
            return row;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }
}
