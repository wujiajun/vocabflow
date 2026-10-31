package com.vocabflow.vocabulary.application;

import java.time.LocalDate;
import java.util.List;

/**
 * Implemented by the learning module, which owns schedules, so this module need not depend on it.
 */
public interface DueVocabularyQuery {
  /** The user's entries to study by {@code date}: learning steps and reviews due by then. */
  List<Long> findDueIds(long userId, LocalDate date);
}
