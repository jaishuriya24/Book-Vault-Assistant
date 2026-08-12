package com.employee.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Runs once per incoming request, BEFORE it reaches any @RestController.
 *
 * Unlike a typical single-app JwtAuthFilter, this one does NOT call a
 * UserDetailsService or hit the database - employee-service has no user
 * table. Everything Spring Security needs (email, role) comes straight out
 * of the token's claims, because auth-service already vetted the password
 * when it issued that token. This is the standard "stateless" pattern
 * microservices use to verify a JWT without a network call back to the
 * service that issued it.
 */
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private static final String HEADER = "Authorization";
    private static final String PREFIX = "Bearer ";

    private final JwtUtil jwtUtil;

    public JwtAuthFilter(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                     @NonNull HttpServletResponse response,
                                     @NonNull FilterChain filterChain)
            throws ServletException, IOException {

        String header = request.getHeader(HEADER);

        if (header == null || !header.startsWith(PREFIX)) {
            filterChain.doFilter(request, response); // no token -> move on
            return;
        }

        String token = header.substring(PREFIX.length());
        String email = jwtUtil.extractUsername(token);

        boolean noAuthYet = SecurityContextHolder.getContext().getAuthentication() == null;

        if (email != null && noAuthYet && jwtUtil.isTokenValid(token, email)) {
            String role = jwtUtil.extractRole(token);
            List<SimpleGrantedAuthority> authorities =
                    List.of(new SimpleGrantedAuthority("ROLE_" + (role != null ? role : "USER")));

            UsernamePasswordAuthenticationToken authToken =
                    new UsernamePasswordAuthenticationToken(email, null, authorities);
            authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(authToken);
        }

        filterChain.doFilter(request, response);
    }
}
