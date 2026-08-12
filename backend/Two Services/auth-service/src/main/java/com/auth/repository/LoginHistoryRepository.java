package com.auth.repository;

import com.auth.entity.LoginHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LoginHistoryRepository extends JpaRepository<LoginHistory, Long> {
    List<LoginHistory> findByUserIdOrderByLoginTimeDesc(Long userId);
    List<LoginHistory> findTop50ByOrderByLoginTimeDesc();
    List<LoginHistory> findTop100ByOrderByLoginTimeDesc();
    List<LoginHistory> findByUserIdInOrderByLoginTimeDesc(List<Long> userIds);
}
