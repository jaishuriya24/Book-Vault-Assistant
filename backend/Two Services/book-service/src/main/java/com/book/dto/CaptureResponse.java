package com.book.dto;

import java.util.Map;

public class CaptureResponse {

    private String status;
    private Boolean page_found;
    private String saved_name;
    private String saved_path;
    private String page_hash;
    private Boolean is_duplicate;
    private Integer duplicate_distance;
    private Boolean quality_valid;
    private String quality_reason;
    private Map<String, Object> metrics;
    private String processed_image_base64;
    private String error;

    public CaptureResponse() {}

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Boolean getPage_found() { return page_found; }
    public void setPage_found(Boolean page_found) { this.page_found = page_found; }

    public String getSaved_name() { return saved_name; }
    public void setSaved_name(String saved_name) { this.saved_name = saved_name; }
    public String getSavedName() { return saved_name; }
    public void setSavedName(String savedName) { this.saved_name = savedName; }

    public String getSaved_path() { return saved_path; }
    public void setSaved_path(String saved_path) { this.saved_path = saved_path; }
    public String getSavedPath() { return saved_path; }
    public void setSavedPath(String savedPath) { this.saved_path = savedPath; }

    public String getPage_hash() { return page_hash; }
    public void setPage_hash(String page_hash) { this.page_hash = page_hash; }

    public Boolean getIs_duplicate() { return is_duplicate; }
    public void setIs_duplicate(Boolean is_duplicate) { this.is_duplicate = is_duplicate; }

    public Integer getDuplicate_distance() { return duplicate_distance; }
    public void setDuplicate_distance(Integer duplicate_distance) { this.duplicate_distance = duplicate_distance; }

    public Boolean getQuality_valid() { return quality_valid; }
    public void setQuality_valid(Boolean quality_valid) { this.quality_valid = quality_valid; }

    public String getQuality_reason() { return quality_reason; }
    public void setQuality_reason(String quality_reason) { this.quality_reason = quality_reason; }

    public Map<String, Object> getMetrics() { return metrics; }
    public void setMetrics(Map<String, Object> metrics) { this.metrics = metrics; }

    public String getProcessed_image_base64() { return processed_image_base64; }
    public void setProcessed_image_base64(String processed_image_base64) { this.processed_image_base64 = processed_image_base64; }
    public String getCapturedImage() { return processed_image_base64; }
    public void setCapturedImage(String capturedImage) { this.processed_image_base64 = capturedImage; }

    public String getError() { return error; }
    public void setError(String error) { this.error = error; }
}
