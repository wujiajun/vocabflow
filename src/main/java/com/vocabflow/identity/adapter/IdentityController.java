package com.vocabflow.identity.adapter;

import com.vocabflow.identity.application.*;
import com.vocabflow.identity.infrastructure.UserEntity;
import com.vocabflow.security.TokenService;
import jakarta.validation.constraints.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
public class IdentityController {
  final IdentityService service;
  final TokenService tokens;

  public IdentityController(IdentityService s, TokenService t) {
    service = s;
    tokens = t;
  }

  record Register(
      @Email String email,
      @NotBlank @Size(min = 8) String password,
      String clbLevel,
      @Min(1) @Max(100) Integer dailyNewVocabularyGoal) {}

  record Login(@Email String email, @NotBlank String password) {}

  record User(long id, String email, String clbLevel, int dailyNewVocabularyGoal) {}

  record LoginResponse(String accessToken, User user) {}

  private User map(UserEntity u) {
    return new User(u.id, u.email, u.clbLevel, u.dailyGoal);
  }

  @PostMapping("/register")
  public User register(@RequestBody @jakarta.validation.Valid Register r) {
    return map(
        service.register(
            r.email,
            r.password,
            r.clbLevel,
            r.dailyNewVocabularyGoal == null ? 10 : r.dailyNewVocabularyGoal));
  }

  @PostMapping("/login")
  public LoginResponse login(@RequestBody @jakarta.validation.Valid Login r) {
    UserEntity u = service.authenticate(r.email, r.password);
    return new LoginResponse(tokens.issue(u.id, u.email), map(u));
  }

  @PostMapping("/logout")
  public void logout(@RequestHeader("Authorization") String h) {
    tokens.revoke(h.substring(7));
  }

  @GetMapping("/me")
  public User me(@AuthenticationPrincipal Long id) {
    return map(service.current(id));
  }
}
