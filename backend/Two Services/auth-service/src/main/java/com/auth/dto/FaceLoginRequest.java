package com.auth.dto;

import java.util.List;

public class FaceLoginRequest {
    private List<Double> faceDescriptor;

    public FaceLoginRequest() {
    }

    public FaceLoginRequest(List<Double> faceDescriptor) {
        this.faceDescriptor = faceDescriptor;
    }

    public List<Double> getFaceDescriptor() {
        return faceDescriptor;
    }

    public void setFaceDescriptor(List<Double> faceDescriptor) {
        this.faceDescriptor = faceDescriptor;
    }
}
