package com.book.repository;

import com.book.entity.Bookmark;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BookmarkRepository extends JpaRepository<Bookmark, Long> {
    List<Bookmark> findByUserIdOrderByUpdatedAtDesc(String userId);
    List<Bookmark> findByBookIdOrderByUpdatedAtDesc(Long bookId);
}
