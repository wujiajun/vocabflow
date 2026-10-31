package com.vocabflow.vocabulary.application;

import java.time.LocalDate;

public interface EnrichmentUsageRepository {
  /** Counts one enrichment call against the user's day; false when the limit is already reached. */
  boolean tryConsume(long userId, LocalDate day, int limit);

  boolean hasRemaining(long userId, LocalDate day, int limit);
}
