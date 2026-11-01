package com.vocabflow.identity.application;

import com.vocabflow.identity.domain.*;
import com.vocabflow.shared.web.*;
import java.time.Instant;
import java.time.ZoneId;
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

  /**
   * Changes what is given; a null leaves that setting as it is. For the time zone an empty text
   * means "use the device's".
   */
  @Transactional
  public User updateSettings(long id, Integer goal, String clbLevel, String timeZone) {
    User user = current(id);
    return users.save(
        new User(
            user.id(),
            user.email(),
            user.passwordHash(),
            clbLevel == null ? user.clbLevel() : ClbLevel.from(clbLevel),
            goal == null ? user.dailyVocabularyGoal() : new DailyVocabularyGoal(goal),
            user.createdAt(),
            timeZone == null ? user.timeZone() : parseTimeZone(timeZone)));
  }

  private static ZoneId parseTimeZone(String value) {
    if (value.isBlank()) {
      return null;
    }
    // Names such as America/Toronto only: an offset like +05:00 does not follow daylight saving.
    if (!ZoneId.getAvailableZoneIds().contains(value.strip()) || !value.contains("/")) {
      throw new IllegalArgumentException("Time zone must be a name such as America/Toronto");
    }
    return ZoneId.of(value.strip());
  }

  public User current(long id) {
    return users.findById(id).orElseThrow(() -> new UnauthorizedException("User no longer exists"));
  }
}
