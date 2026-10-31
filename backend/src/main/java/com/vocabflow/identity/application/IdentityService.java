package com.vocabflow.identity.application;

import com.vocabflow.identity.domain.*;
import com.vocabflow.shared.web.*;
import java.time.Instant;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class IdentityService {
  private final UserRepository users;
  private final PasswordEncoder passwords;

  public IdentityService(UserRepository u, PasswordEncoder p) {
    users = u;
    passwords = p;
  }

  @Transactional
  public User register(String email, String password, String clb, int goal) {
    Email e = new Email(email);
    if (password == null || password.length() < 8)
      throw new BadRequestException("Password must contain at least 8 characters");
    if (users.existsByEmail(e)) throw new ConflictException("Email is already registered");
    return users.save(
        new User(
            0,
            e,
            passwords.encode(password),
            ClbLevel.from(clb == null ? "CLB_4" : clb),
            new DailyVocabularyGoal(goal == 0 ? 10 : goal),
            Instant.now()));
  }

  public User authenticate(String email, String password) {
    User u =
        users
            .findByEmail(new Email(email))
            .orElseThrow(() -> new UnauthorizedException("Invalid email or password"));
    if (!passwords.matches(password, u.passwordHash()))
      throw new UnauthorizedException("Invalid email or password");
    return u;
  }

  @Transactional
  public User updateDailyGoal(long id, int goal) {
    User user = current(id);
    return users.save(
        new User(
            user.id(),
            user.email(),
            user.passwordHash(),
            user.clbLevel(),
            new DailyVocabularyGoal(goal),
            user.createdAt()));
  }

  public User current(long id) {
    return users.findById(id).orElseThrow(() -> new UnauthorizedException("User no longer exists"));
  }
}
