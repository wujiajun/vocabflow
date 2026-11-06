package com.vocabflow.vocabulary.domain;

import java.time.Instant;

/** {@code source} is null for a word that was typed, and for words added before it existed. */
public record UserVocabulary(
    long id,
    long userId,
    VocabularyItem item,
    LearningStatus learningStatus,
    Instant createdAt,
    SourceContext source) {
  public UserVocabulary(
      long id, long userId, VocabularyItem item, LearningStatus learningStatus, Instant createdAt) {
    this(id, userId, item, learningStatus, createdAt, null);
  }
}
