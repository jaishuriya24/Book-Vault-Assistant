package com.book.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "books")
public class Book {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "title", nullable = false, length = 500)
    private String title;

    @Column(name = "author", length = 255)
    private String author = "Unknown";

    @Column(name = "language", length = 20)
    private String language = "eng";

    @Lob
    @Column(name = "full_text", columnDefinition = "LONGTEXT")
    private String fullText = "";

    @Lob
    @Column(name = "content", columnDefinition = "LONGTEXT")
    private String content = "";

    @Column(name = "source", length = 50)
    private String source = "manual";

    @Column(name = "last_position_char")
    private Integer lastPositionChar = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();

    @Lob
    @Column(name = "cover_image", columnDefinition = "LONGTEXT")
    private String coverImage;

    public Book() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getAuthor() { return author; }
    public void setAuthor(String author) { this.author = author; }

    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }

    public String getFullText() { return fullText; }
    public void setFullText(String fullText) { this.fullText = fullText; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public Integer getLastPositionChar() { return lastPositionChar; }
    public void setLastPositionChar(Integer lastPositionChar) { this.lastPositionChar = lastPositionChar; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public String getCoverImage() { return coverImage; }
    public void setCoverImage(String coverImage) { this.coverImage = coverImage; }
}
