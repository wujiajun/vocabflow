package com.vocabflow.identity.domain;

import java.time.Instant;
import java.time.ZoneId;

/** {@code timeZone} is where the user's study day starts and ends; null means use the device's. */
public record User(
    long id,
    Email email,
    String passwordHash,
    ClbLevel clbLevel,
    DailyVocabularyGoal dailyVocabularyGoal,
    Instant createdAt,
    ZoneId timeZone) {
  public User(
      long id,
      Email email,
      String passwordHash,
      ClbLevel clbLevel,
      DailyVocabularyGoal dailyVocabularyGoal,
      Instant createdAt) {
    this(id, email, passwordHash, clbLevel, dailyVocabularyGoal, createdAt, null);
  }
}
