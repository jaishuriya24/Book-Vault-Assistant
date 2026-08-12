package com.book.service;

import com.book.dto.BookRequest;
import com.book.dto.PositionUpdateRequest;
import com.book.entity.Book;
import com.book.repository.BookRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class BookService {

    private final BookRepository bookRepository;

    public BookService(BookRepository bookRepository) {
        this.bookRepository = bookRepository;
    }

    public Book createBook(BookRequest request, String userId) {
        Book book = new Book();
        book.setUserId(userId != null ? userId : "Guest");
        book.setUserName("Reader");
        book.setTitle(request.getTitle());
        book.setLanguage(request.getLanguage() != null ? request.getLanguage() : "eng");
        String txt = request.getFullText() != null ? request.getFullText() : (request.getContent() != null ? request.getContent() : "");
        book.setFullText(txt);
        book.setContent(txt);
        book.setSource(request.getSource() != null ? request.getSource() : "manual");
        book.setCoverImage(request.getCoverImage());
        book.setLastPositionChar(0);
        book.setCreatedAt(LocalDateTime.now());
        return bookRepository.save(book);
    }

    public List<Book> getAllBooks() {
        return bookRepository.findAllByOrderByIdDesc();
    }

    public List<Book> getUserBooks(String userId) {
        if (userId == null || "Guest".equalsIgnoreCase(userId)) {
            return getAllBooks();
        }
        return bookRepository.findByUserIdOrderByIdDesc(userId);
    }

    public Optional<Book> getBookById(Long id) {
        return bookRepository.findById(id);
    }

    public List<Book> searchBooks(String query) {
        if (query == null || query.isBlank()) {
            return getAllBooks();
        }
        return bookRepository.searchBooks(query);
    }

    public Book updateBook(Long id, BookRequest request, Long userId) {
        Book book = getBookById(id, userId)
                .orElseThrow(() -> new IllegalArgumentException("Book not found with ID: " + id));

        if (request.getTitle() != null && !request.getTitle().isBlank()) {
            book.setTitle(request.getTitle());
        }
        if (request.getLanguage() != null) {
            book.setLanguage(request.getLanguage());
        }
        if (request.getFullText() != null) {
            book.setFullText(request.getFullText());
        }
        if (request.getSource() != null) {
            book.setSource(request.getSource());
        }
        if (request.getCoverImage() != null) {
            book.setCoverImage(request.getCoverImage());
        }
        return bookRepository.save(book);
    }

    public Book updatePosition(Long id, PositionUpdateRequest request, Long userId) {
        Book book = getBookById(id, userId)
                .orElseThrow(() -> new IllegalArgumentException("Book not found with ID: " + id));

        book.setLastPositionChar(request.getLastPositionChar());
        return bookRepository.save(book);
    }

    public void deleteBook(Long id, Long userId) {
        Book book = getBookById(id, userId)
                .orElseThrow(() -> new IllegalArgumentException("Book not found with ID: " + id));
        bookRepository.delete(book);
    }
}
