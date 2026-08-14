package com.book.dto;

import java.util.List;

public class VoiceCommandRequest {
    private String transcript;
    private String context;
    private boolean authenticated;
    private String activeUser;
    private String currentRoute;
    private String activeBookTitle;
    private Integer activePageNumber;
    private Integer bookCount;
    private List<String> userBookTitles;
    private String activePageText;
    private String pendingField;
    private String pendingAction;

    public VoiceCommandRequest() {}

    public String getTranscript() {
        return transcript;
    }

    public void setTranscript(String transcript) {
        this.transcript = transcript;
    }

    public String getContext() {
        return context;
    }

    public void setContext(String context) {
        this.context = context;
    }

    public boolean isAuthenticated() {
        return authenticated;
    }

    public void setAuthenticated(boolean authenticated) {
        this.authenticated = authenticated;
    }

    public String getActiveUser() {
        return activeUser;
    }

    public void setActiveUser(String activeUser) {
        this.activeUser = activeUser;
    }

    public String getCurrentRoute() {
        return currentRoute;
    }

    public void setCurrentRoute(String currentRoute) {
        this.currentRoute = currentRoute;
    }

    public String getActiveBookTitle() {
        return activeBookTitle;
    }

    public void setActiveBookTitle(String activeBookTitle) {
        this.activeBookTitle = activeBookTitle;
    }

    public Integer getActivePageNumber() {
        return activePageNumber;
    }

    public void setActivePageNumber(Integer activePageNumber) {
        this.activePageNumber = activePageNumber;
    }

    public Integer getBookCount() {
        return bookCount;
    }

    public void setBookCount(Integer bookCount) {
        this.bookCount = bookCount;
    }

    public List<String> getUserBookTitles() {
        return userBookTitles;
    }

    public void setUserBookTitles(List<String> userBookTitles) {
        this.userBookTitles = userBookTitles;
    }

    public String getActivePageText() {
        return activePageText;
    }

    public void setActivePageText(String activePageText) {
        this.activePageText = activePageText;
    }

    public String getPendingField() {
        return pendingField;
    }

    public void setPendingField(String pendingField) {
        this.pendingField = pendingField;
    }

    public String getPendingAction() {
        return pendingAction;
    }

    public void setPendingAction(String pendingAction) {
        this.pendingAction = pendingAction;
    }
}
