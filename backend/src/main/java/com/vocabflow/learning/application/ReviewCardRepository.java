package com.vocabflow.learning.application;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Map;

public interface ReviewCardRepository {
  /** Must not run inside a shared transaction: it catches a duplicate-key error. */
  void createIfAbsent(long userId, long userVocabularyId, Instant now);

  /** Cards in LEARNING or RELEARNING, soonest due first. */
  List<StoredCard> findInLearning(long userId);

  /** Cards in REVIEW due on or before {@code date}, most overdue first. */
  List<StoredCard> findDueReviews(long userId, LocalDate date);

  Map<Long, StoredCard> findByUserVocabularyIds(long userId, Collection<Long> userVocabularyIds);

  /** Returns false when the stored version is no longer {@code card.version()}. */
  boolean update(long userId, StoredCard card);

  void log(ReviewLogEntry entry);
}
