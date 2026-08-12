package com.book.repository;

import com.book.entity.Page;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PageRepository extends JpaRepository<Page, Long> {
    List<Page> findByBookIdOrderByPageNumberAsc(Long bookId);
}
