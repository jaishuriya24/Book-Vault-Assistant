package com.auth.dto;

import java.util.List;

public class FaceRegisterRequest {
    private String name;
    private String email;
    private List<Double> faceDescriptor;

    public FaceRegisterRequest() {
    }

    public FaceRegisterRequest(String name, String email, List<Double> faceDescriptor) {
        this.name = name;
        this.email = email;
        this.faceDescriptor = faceDescriptor;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public List<Double> getFaceDescriptor() {
        return faceDescriptor;
    }

    public void setFaceDescriptor(List<Double> faceDescriptor) {
        this.faceDescriptor = faceDescriptor;
    }
}
