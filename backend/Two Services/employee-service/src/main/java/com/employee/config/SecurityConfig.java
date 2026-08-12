package com.employee.config;

import com.employee.security.JwtAuthFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Role scheme used throughout this service: EMPLOYEE, MANAGER, ADMIN
 * (must match the roles issued by auth-service - see com.auth.entity.Role
 * there). Two ways to enforce roles are shown here on purpose, so students
 * see both styles:
 *   1. URL/method-based, below, via requestMatchers(...).hasAnyRole(...)
 *   2. Annotation-based, via @EnableMethodSecurity + @PreAuthorize on
 *      EmployeeController.deleteEmployee()
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter) {
        this.jwtAuthFilter = jwtAuthFilter;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session ->
                    session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                    // Without this, an unhandled exception (e.g. a DB error)
                    // gets forwarded internally to /error, which then hits
                    // this same rule set - and since it's not permitted, you
                    // see a misleading 403 instead of the real 500.
                    .requestMatchers("/error").permitAll()
                    // Read access: any logged-in employee, manager, or admin.
                    .requestMatchers(HttpMethod.GET, "/api/employees/**")
                        .hasAnyRole("EMPLOYEE", "MANAGER", "ADMIN")
                    // Create/update: managers and admins only - a plain employee
                    // can look employees up but not add or change records.
                    .requestMatchers(HttpMethod.POST, "/api/employees/**")
                        .hasAnyRole("MANAGER", "ADMIN")
                    .requestMatchers(HttpMethod.PUT, "/api/employees/**")
                        .hasAnyRole("MANAGER", "ADMIN")
                    // DELETE is intentionally left unlisted here - it's enforced
                    // with @PreAuthorize("hasRole('ADMIN')") on the controller
                    // method instead, as the second style of role check.
                    .anyRequest().authenticated())
            .exceptionHandling(handling -> handling
                    // No token / bad token -> 401 with a JSON body instead of
                    // Spring Security's default empty response.
                    .authenticationEntryPoint((request, response, ex) -> {
                        response.setStatus(HttpStatus.UNAUTHORIZED.value());
                        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                        response.getWriter().write("{\"error\":\"Missing or invalid token\"}");
                    })
                    // Valid token, wrong role -> 403 with a JSON body.
                    .accessDeniedHandler((request, response, ex) -> {
                        response.setStatus(HttpStatus.FORBIDDEN.value());
                        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                        response.getWriter().write("{\"error\":\"You do not have permission for this action\"}");
                    }))
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
