package com.auth.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Stores audit logs for every login attempt in MySQL.
 * Enables tracking face recognition accuracy, timestamps, and login status.
 */
@Entity
@Table(name = "login_history")
public class LoginHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "user_email", length = 150)
    private String userEmail;

    @Column(name = "user_name", length = 150)
    private String userName;

    @Column(name = "login_time", nullable = false)
    private LocalDateTime loginTime = LocalDateTime.now();

    @Column(name = "auth_method", length = 50)
    private String authMethod; // "FACE_RECOGNITION", "VOICE", "PASSWORD"

    @Column(name = "status", length = 20)
    private String status; // "SUCCESS", "FAILED"

    @Column(name = "match_distance")
    private Double matchDistance;

    @Column(name = "note", length = 255)
    private String note;

    public LoginHistory() {
    }

    public LoginHistory(Long userId, String userEmail, String userName, String authMethod, String status, Double matchDistance, String note) {
        this.userId = userId;
        this.userEmail = userEmail;
        this.userName = userName;
        this.authMethod = authMethod;
        this.status = status;
        this.matchDistance = matchDistance;
        this.note = note;
        this.loginTime = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getUserEmail() { return userEmail; }
    public void setUserEmail(String userEmail) { this.userEmail = userEmail; }
    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }
    public LocalDateTime getLoginTime() { return loginTime; }
    public void setLoginTime(LocalDateTime loginTime) { this.loginTime = loginTime; }
    public String getAuthMethod() { return authMethod; }
    public void setAuthMethod(String authMethod) { this.authMethod = authMethod; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Double getMatchDistance() { return matchDistance; }
    public void setMatchDistance(Double matchDistance) { this.matchDistance = matchDistance; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
}
