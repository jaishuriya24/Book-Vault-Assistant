package com.book.repository;

import com.book.entity.Book;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface BookRepository extends JpaRepository<Book, Long> {

    List<Book> findByUserIdOrderByCreatedAtDesc(Long userId);

    Optional<Book> findByIdAndUserId(Long id, Long userId);

    @Query(value = "SELECT * FROM books WHERE user_id = :userId AND " +
                   "(LOWER(title) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
                   "LOWER(full_text) LIKE LOWER(CONCAT('%', :query, '%')))", nativeQuery = true)
    List<Book> searchBooks(@Param("userId") Long userId, @Param("query") String query);
}
