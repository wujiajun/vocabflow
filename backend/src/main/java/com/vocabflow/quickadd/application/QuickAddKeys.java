package com.vocabflow.quickadd.application;

import java.time.Instant;
import java.util.Optional;

/** Where the hashes of the quick-add keys are kept: one per learner. */
public interface QuickAddKeys {
  record Status(Instant createdAt, Instant lastUsedAt) {}

  /** Keeps this hash as the learner's key, replacing the one before. */
  void replace(long userId, String keyHash, Instant at);

  Optional<Long> userIdFor(String keyHash);

  void markUsed(String keyHash, Instant at);

  /** Returns whether there was a key to delete. */
  boolean delete(long userId);

  Optional<Status> status(long userId);
}
