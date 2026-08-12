package com.employee.controller;

import com.employee.entity.Employee;
import com.employee.service.EmployeeService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Was a browser-facing @Controller returning JSP view names
 * ("employee-list", "employee-form"). As a microservice, this now returns
 * JSON instead - the natural shape for something meant to be called by
 * other services, a Postman collection, or a separate frontend app.
 *
 * EmployeeService and EmployeeRepository underneath are UNCHANGED from the
 * original project - only this controller layer changed.
 */
@RestController
@RequestMapping("/api/employees")
public class EmployeeController {

    private final EmployeeService employeeService;

    public EmployeeController(EmployeeService employeeService) {
        this.employeeService = employeeService;
    }

    @GetMapping
    public List<Employee> listEmployees() {
        return employeeService.getAllEmployees();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Employee> getEmployee(@PathVariable long id) {
        Employee employee = employeeService.getEmployeeById(id);
        return employee != null ? ResponseEntity.ok(employee) : ResponseEntity.notFound().build();
    }

    @PostMapping
    public ResponseEntity<?> createEmployee(@RequestBody Employee employee) {
        try {
            employeeService.addEmployee(employee);
            return ResponseEntity.ok(employee);
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.badRequest().body(exception.getMessage());
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateEmployee(@PathVariable long id, @RequestBody Employee employee) {
        if (employeeService.getEmployeeById(id) == null) {
            return ResponseEntity.notFound().build();
        }
        try {
            employee.setId(id);
            employeeService.updateEmployee(employee);
            return ResponseEntity.ok(employee);
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.badRequest().body(exception.getMessage());
        }
    }

    // Delete is restricted with @PreAuthorize instead of a requestMatcher in
    // SecurityConfig - the second style of role check, enforced right next
    // to the method it protects. Only ADMIN can delete an employee.
    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteEmployee(@PathVariable long id) {
        if (employeeService.getEmployeeById(id) == null) {
            return ResponseEntity.notFound().build();
        }
        employeeService.deleteEmployee(id);
        return ResponseEntity.noContent().build();
    }
}
