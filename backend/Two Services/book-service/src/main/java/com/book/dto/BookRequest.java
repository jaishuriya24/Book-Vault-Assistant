package com.book.dto;

import jakarta.validation.constraints.NotBlank;

public class BookRequest {

    @NotBlank(message = "Title is required")
    private String title;

    private String language = "eng";
    private String fullText = "";
    private String source = "manual";
    private String coverImage;

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }

    public String getFullText() { return fullText; }
    public void setFullText(String fullText) { this.fullText = fullText; }

    public void setContent(String content) { this.fullText = content; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public String getCoverImage() { return coverImage; }
    public void setCoverImage(String coverImage) { this.coverImage = coverImage; }
}
