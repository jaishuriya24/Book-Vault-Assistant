package com.book.dto;

public class OcrResponse {
    private boolean success;
    private String text;
    private String error;
    private long processingTimeMs;

    public OcrResponse(boolean success, String text, long processingTimeMs) {
        this.success = success;
        this.text = text;
        this.processingTimeMs = processingTimeMs;
    }

    public OcrResponse(boolean success, String text, String error, long processingTimeMs) {
        this.success = success;
        this.text = text;
        this.error = error;
        this.processingTimeMs = processingTimeMs;
    }

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public String getError() {
        return error;
    }

    public void setError(String error) {
        this.error = error;
    }

    public long getProcessingTimeMs() {
        return processingTimeMs;
    }

    public void setProcessingTimeMs(long processingTimeMs) {
        this.processingTimeMs = processingTimeMs;
    }
}
