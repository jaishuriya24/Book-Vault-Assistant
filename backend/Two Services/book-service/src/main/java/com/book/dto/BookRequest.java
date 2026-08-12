package com.book.dto;

import jakarta.validation.constraints.NotBlank;

public class BookRequest {

    @NotBlank(message = "Title is required")
    private String title;

    private String author = "Unknown";
    private String language = "eng";
    private String fullText = "";
    private String content = "";
    private String source = "manual";
    private String coverImage;
    private String cover;
    private String userId = "Guest";
    private String userName = "Reader";
    private Integer pageCount = 1;

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getAuthor() { return author; }
    public void setAuthor(String author) { this.author = author; }

    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }

    public String getFullText() { return fullText != null && !fullText.isEmpty() ? fullText : content; }
    public void setFullText(String fullText) { this.fullText = fullText; }

    public String getContent() { return content != null && !content.isEmpty() ? content : fullText; }
    public void setContent(String content) { this.content = content; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public String getCoverImage() { return coverImage != null ? coverImage : cover; }
    public void setCoverImage(String coverImage) { this.coverImage = coverImage; }

    public String getCover() { return cover != null ? cover : coverImage; }
    public void setCover(String cover) { this.cover = cover; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }

    public Integer getPageCount() { return pageCount; }
    public void setPageCount(Integer pageCount) { this.pageCount = pageCount; }
}
