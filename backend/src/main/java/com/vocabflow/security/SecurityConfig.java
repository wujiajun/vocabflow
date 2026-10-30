package com.vocabflow.security;

import com.vocabflow.identity.application.UserRepository;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.*;
import org.springframework.context.annotation.*;
import org.springframework.security.authentication.*;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.*;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.filter.OncePerRequestFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {
  @Bean
  PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder();
  }

  @Bean
  SecurityFilterChain filterChain(
      HttpSecurity h,
      TokenService t,
      UserRepository users,
      JsonAuthenticationEntryPoint authenticationEntryPoint,
      JsonAccessDeniedHandler accessDeniedHandler)
      throws Exception {
    return h.csrf(c -> c.disable())
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .exceptionHandling(
            e ->
                e.authenticationEntryPoint(authenticationEntryPoint)
                    .accessDeniedHandler(accessDeniedHandler))
        .authorizeHttpRequests(
            a ->
                a.requestMatchers("/api/v1/auth/register", "/api/v1/auth/login")
                    .permitAll()
                    .anyRequest()
                    .authenticated())
        .addFilterBefore(new JwtFilter(t, users), UsernamePasswordAuthenticationFilter.class)
        .build();
  }

  static class JwtFilter extends OncePerRequestFilter {
    final TokenService t;
    final UserRepository users;

    JwtFilter(TokenService x, UserRepository u) {
      t = x;
      users = u;
    }

    protected void doFilterInternal(HttpServletRequest r, HttpServletResponse s, FilterChain c)
        throws ServletException, IOException {
      String h = r.getHeader("Authorization");
      var token = BearerTokenExtractor.extract(h);
      if (token.isPresent()) {
        Long id = t.verify(token.get());
        // A signature-valid token whose user is gone (deleted, or the database was reset) is
        // treated as no token, so every protected endpoint answers the same 401.
        if (id != null && users.existsById(id))
          SecurityContextHolder.getContext()
              .setAuthentication(
                  new UsernamePasswordAuthenticationToken(
                      id, null, List.of(new SimpleGrantedAuthority("ROLE_USER"))));
      }
      c.doFilter(r, s);
    }
  }
}
