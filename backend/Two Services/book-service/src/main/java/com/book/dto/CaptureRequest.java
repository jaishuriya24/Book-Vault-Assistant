package com.book.dto;

import jakarta.validation.constraints.NotBlank;

public class CaptureRequest {

    @NotBlank(message = "image_base64 is required")
    private String image_base64;

    private String filename;

    public CaptureRequest() {}

    public CaptureRequest(String image_base64, String filename) {
        this.image_base64 = image_base64;
        this.filename = filename;
    }

    public String getImage_base64() {
        return image_base64;
    }

    public void setImage_base64(String image_base64) {
        this.image_base64 = image_base64;
    }

    public String getImageBase64() {
        return image_base64;
    }

    public void setImageBase64(String imageBase64) {
        this.image_base64 = imageBase64;
    }

    public String getFilename() {
        return filename;
    }

    public void setFilename(String filename) {
        this.filename = filename;
    }
}
