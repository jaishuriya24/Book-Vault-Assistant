package com.book.controller;

import com.book.entity.Book;
import com.book.entity.Bookmark;
import com.book.repository.BookRepository;
import com.book.repository.BookmarkRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/bookmarks")
@CrossOrigin(origins = "*")
public class BookmarkController {

    private final BookmarkRepository bookmarkRepository;
    private final BookRepository bookRepository;

    public BookmarkController(BookmarkRepository bookmarkRepository, BookRepository bookRepository) {
        this.bookmarkRepository = bookmarkRepository;
        this.bookRepository = bookRepository;
    }

    @GetMapping
    public ResponseEntity<?> getBookmarks(@RequestParam(required = false) String userId,
                                          @RequestParam(required = false) Long bookId) {
        try {
            List<Bookmark> list = new ArrayList<>();
            if (userId != null && !userId.isBlank()) {
                list = bookmarkRepository.findByUserIdOrderByUpdatedAtDesc(userId);
            } else if (bookId != null) {
                list = bookmarkRepository.findByBookIdOrderByUpdatedAtDesc(bookId);
            } else {
                list = bookmarkRepository.findAll();
            }

            List<Map<String, Object>> res = new ArrayList<>();
            for (Bookmark bm : list) {
                Map<String, Object> map = new HashMap<>();
                map.put("id", String.valueOf(bm.getId()));
                map.put("userId", bm.getUserId());
                map.put("bookId", String.valueOf(bm.getBookId()));
                
                String title = "Unknown Book";
                if (bm.getBookId() != null) {
                    Optional<Book> b = bookRepository.findById(bm.getBookId());
                    if (b.isPresent()) title = b.get().getTitle();
                }
                map.put("bookTitle", title);
                map.put("pageNumber", bm.getPageNumber());
                map.put("charPosition", bm.getCharPosition());
                map.put("note", bm.getNote());
                map.put("createdAt", bm.getCreatedAt());
                map.put("updatedAt", bm.getUpdatedAt());
                res.add(map);
            }
            return ResponseEntity.ok(res);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping
    public ResponseEntity<?> createBookmark(@RequestBody Map<String, Object> body) {
        try {
            String userId = body.get("userId") != null ? body.get("userId").toString() : null;
            Object bookIdObj = body.get("bookId");
            if (bookIdObj == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "bookId is required"));
            }
            Long bookId = Long.valueOf(bookIdObj.toString());
            Integer pageNumber = body.get("pageNumber") != null ? Integer.valueOf(body.get("pageNumber").toString()) : 1;
            Integer charPosition = body.get("charPosition") != null ? Integer.valueOf(body.get("charPosition").toString()) : 0;
            String note = body.get("note") != null ? body.get("note").toString() : null;

            Bookmark bm = new Bookmark();
            bm.setUserId(userId);
            bm.setBookId(bookId);
            bm.setPageNumber(pageNumber);
            bm.setCharPosition(charPosition);
            bm.setNote(note);

            Bookmark saved = bookmarkRepository.save(bm);

            Map<String, Object> res = new HashMap<>();
            res.put("success", true);
            res.put("id", String.valueOf(saved.getId()));
            res.put("userId", userId);
            res.put("bookId", String.valueOf(bookId));
            res.put("pageNumber", pageNumber);
            res.put("charPosition", charPosition);
            res.put("note", note);

            return ResponseEntity.status(201).body(res);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }
}
