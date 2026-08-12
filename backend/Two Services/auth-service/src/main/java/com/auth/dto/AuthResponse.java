package com.auth.dto;

public class AuthResponse {

    private boolean success = true;
    private String token;
    private String tokenType = "Bearer";
    private Long userId;
    private String username;
    private String email;
    private String name;
    private String role;
    private String sourceTable = "app_users";
    private Double matchDistance;

    public AuthResponse(String token, Long userId, String email, String role) {
        this.token = token;
        this.userId = userId;
        this.email = email;
        this.role = role;
    }

    public AuthResponse(String token, Long userId, String email, String name, String role) {
        this.token = token;
        this.userId = userId;
        this.email = email;
        this.name = name;
        this.role = role;
    }

    public AuthResponse(boolean success, String token, Long userId, String name, String username, String email, String role, String sourceTable, Double matchDistance) {
        this.success = success;
        this.token = token;
        this.userId = userId;
        this.name = name;
        this.username = username;
        this.email = email;
        this.role = role;
        this.sourceTable = sourceTable;
        this.matchDistance = matchDistance;
    }

    public boolean isSuccess() { return success; }
    public String getToken() { return token; }
    public String getTokenType() { return tokenType; }
    public Long getUserId() { return userId; }
    public Long getId() { return userId; }
    public String getUsername() { return username != null ? username : (name != null ? name.toLowerCase().replaceAll("\\s+", "") : ""); }
    public String getEmail() { return email; }
    public String getName() { return name; }
    public String getRole() { return role; }
    public String getSourceTable() { return sourceTable; }
    public Double getMatchDistance() { return matchDistance; }
}
