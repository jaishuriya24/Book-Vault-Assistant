package com.auth.repository;

import com.auth.entity.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AppUserRepository extends JpaRepository<AppUser, Long> {
    Optional<AppUser> findByEmail(String email);
    boolean existsByEmail(String email);
    List<AppUser> findByRoleOrderByIdAsc(String role);
    List<AppUser> findByRoleInOrderByIdAsc(List<String> roles);
    
    @org.springframework.transaction.annotation.Transactional
    void deleteByFaceDescriptorIsNotNull();
}
