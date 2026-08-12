package com.book.controller;

import com.book.dto.BookRequest;
import com.book.dto.PositionUpdateRequest;
import com.book.entity.Book;
import com.book.security.UserPrincipal;
import com.book.service.BookService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/books")
public class BookController {

    private final BookService bookService;

    public BookController(BookService bookService) {
        this.bookService = bookService;
    }

    private Long resolveUserId(UserPrincipal user) {
        return (user != null && user.getUserId() != null) ? user.getUserId() : 1L;
    }

    @GetMapping
    public ResponseEntity<List<Book>> listBooks() {
        List<Book> books = bookService.getAllBooks();
        return ResponseEntity.ok(books);
    }

    @GetMapping("/search")
    public ResponseEntity<List<Book>> searchBooks(@RequestParam("q") String query) {
        List<Book> books = bookService.searchBooks(query);
        return ResponseEntity.ok(books);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Book> getBook(@PathVariable Long id) {
        return bookService.getBookById(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> createBook(@RequestBody BookRequest request) {
        try {
            Book book = bookService.createBook(request, "Guest");
            return ResponseEntity.status(HttpStatus.CREATED).body(book);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateBook(
            @PathVariable Long id,
            @Valid @RequestBody BookRequest request,
            @AuthenticationPrincipal UserPrincipal user) {
        try {
            Book book = bookService.updateBook(id, request, resolveUserId(user));
            return ResponseEntity.ok(book);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    @PatchMapping("/{id}/position")
    public ResponseEntity<?> updatePosition(
            @PathVariable Long id,
            @Valid @RequestBody PositionUpdateRequest request,
            @AuthenticationPrincipal UserPrincipal user) {
        try {
            Book book = bookService.updatePosition(id, request, resolveUserId(user));
            return ResponseEntity.ok(book);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteBook(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal user) {
        try {
            bookService.deleteBook(id, resolveUserId(user));
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }
}
