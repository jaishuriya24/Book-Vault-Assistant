package com.employee.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.employee.entity.Employee;

// Spring Data JPA generates the implementation of this interface at startup.
// save(), findAll(), findById(), deleteById() all come for free from JpaRepository.
public interface EmployeeRepository extends JpaRepository<Employee, Long> {
}
