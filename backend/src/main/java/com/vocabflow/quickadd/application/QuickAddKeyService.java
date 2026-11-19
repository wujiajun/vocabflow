package com.vocabflow.quickadd.application;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import org.springframework.stereotype.Service;

/**
 * Makes, checks and revokes the key a learner can hand to a shortcut. The key is 256 random bits,
 * only its hash is stored, and it opens just the one door that adds a word; it is never a login.
 */
@Service
public class QuickAddKeyService {
  static final String PREFIX = "vfq_";
  private static final int MAX_LENGTH = 100;

  private final QuickAddKeys keys;
  private final Clock clock;
  private final SecureRandom random = new SecureRandom();

  public QuickAddKeyService(QuickAddKeys keys, Clock clock) {
    this.keys = keys;
    this.clock = clock;
  }

  public record Created(String key, java.time.Instant createdAt) {}

  /** Makes a new key, which replaces the one before. The key is returned only here. */
  public Created create(long userId) {
    byte[] bytes = new byte[32];
    random.nextBytes(bytes);
    String key = PREFIX + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    java.time.Instant now = clock.instant();
    keys.replace(userId, hash(key), now);
    return new Created(key, now);
  }

  public Optional<QuickAddKeys.Status> status(long userId) {
    return keys.status(userId);
  }

  public boolean revoke(long userId) {
    return keys.delete(userId);
  }

  /** The learner this key belongs to, if it is a key that is still in use. */
  public Optional<Long> authenticate(String key) {
    if (key == null || key.length() > MAX_LENGTH || !key.startsWith(PREFIX)) {
      return Optional.empty();
    }
    String hash = hash(key);
    Optional<Long> userId = keys.userIdFor(hash);
    userId.ifPresent(id -> keys.markUsed(hash, clock.instant()));
    return userId;
  }

  static String hash(String key) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(key.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException impossible) {
      throw new IllegalStateException(impossible);
    }
  }
}
