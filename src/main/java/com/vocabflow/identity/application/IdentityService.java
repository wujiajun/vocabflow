package com.vocabflow.identity.application;

import com.vocabflow.identity.domain.*;
import com.vocabflow.identity.infrastructure.*;
import com.vocabflow.shared.web.*;
import java.time.Instant;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class IdentityService {
  private final UserJpaRepository users;
  private final PasswordEncoder passwords;

  public IdentityService(UserJpaRepository u, PasswordEncoder p) {
    users = u;
    passwords = p;
  }

  @Transactional
  public UserEntity register(String email, String password, String clb, int goal) {
    Email e = new Email(email);
    if (password == null || password.length() < 8)
      throw new BadRequestException("Password must contain at least 8 characters");
    if (users.existsByEmail(e.value())) throw new ConflictException("Email is already registered");
    UserEntity u = new UserEntity();
    u.email = e.value();
    u.passwordHash = passwords.encode(password);
    u.clbLevel = ClbLevel.from(clb == null ? "CLB_4" : clb).name();
    u.dailyGoal = new DailyVocabularyGoal(goal == 0 ? 10 : goal).value();
    u.createdAt = Instant.now();
    return users.save(u);
  }

  public UserEntity authenticate(String email, String password) {
    UserEntity u =
        users
            .findByEmail(new Email(email).value())
            .orElseThrow(() -> new UnauthorizedException("Invalid email or password"));
    if (!passwords.matches(password, u.passwordHash))
      throw new UnauthorizedException("Invalid email or password");
    return u;
  }

  public UserEntity current(long id) {
    return users.findById(id).orElseThrow(() -> new UnauthorizedException("User no longer exists"));
  }
}
