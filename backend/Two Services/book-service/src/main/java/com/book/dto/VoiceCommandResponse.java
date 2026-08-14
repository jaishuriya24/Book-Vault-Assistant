package com.book.dto;

public class VoiceCommandResponse {
    private String action;
    private String query;
    private String target;
    private String field;
    private String value;
    private String feedbackTts;
    private Double speakingSpeed;
    private boolean valid;

    public VoiceCommandResponse() {}

    public VoiceCommandResponse(String action, String query, String target, String feedbackTts, boolean valid) {
        this.action = action;
        this.query = query;
        this.target = target;
        this.feedbackTts = feedbackTts;
        this.valid = valid;
    }

    public VoiceCommandResponse(String action, String query, String target, String feedbackTts, Double speakingSpeed, boolean valid) {
        this.action = action;
        this.query = query;
        this.target = target;
        this.feedbackTts = feedbackTts;
        this.speakingSpeed = speakingSpeed;
        this.valid = valid;
    }

    public VoiceCommandResponse(String action, String query, String target, String field, String value, String feedbackTts, Double speakingSpeed, boolean valid) {
        this.action = action;
        this.query = query;
        this.target = target;
        this.field = field;
        this.value = value;
        this.feedbackTts = feedbackTts;
        this.speakingSpeed = speakingSpeed;
        this.valid = valid;
    }

    public String getAction() {
        return action;
    }

    public void setAction(String action) {
        this.action = action;
    }

    public String getQuery() {
        return query;
    }

    public void setQuery(String query) {
        this.query = query;
    }

    public String getTarget() {
        return target;
    }

    public void setTarget(String target) {
        this.target = target;
    }

    public String getField() {
        return field;
    }

    public void setField(String field) {
        this.field = field;
    }

    public String getValue() {
        return value;
    }

    public void setValue(String value) {
        this.value = value;
    }

    public String getFeedbackTts() {
        return feedbackTts;
    }

    public void setFeedbackTts(String feedbackTts) {
        this.feedbackTts = feedbackTts;
    }

    public Double getSpeakingSpeed() {
        return speakingSpeed;
    }

    public void setSpeakingSpeed(Double speakingSpeed) {
        this.speakingSpeed = speakingSpeed;
    }

    public boolean isValid() {
        return valid;
    }

    public void setValid(boolean valid) {
        this.valid = valid;
    }
}
