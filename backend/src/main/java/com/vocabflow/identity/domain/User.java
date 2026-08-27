package com.vocabflow.identity.domain;

import java.time.Instant;

public record User(
    long id,
    Email email,
    String passwordHash,
    ClbLevel clbLevel,
    DailyVocabularyGoal dailyVocabularyGoal,
    Instant createdAt) {}
