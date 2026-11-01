package com.vocabflow.vocabulary.application;

/**
 * Implemented by the learning module, which owns plans, cards and review logs, so this module need
 * not depend on it.
 */
public interface StudyRecords {
  /** Whether the user has ever rated the word. */
  boolean hasHistory(long userId, long userVocabularyId);

  /**
   * Takes the word out of every stored daily plan that lists it; the other items keep their order.
   */
  void removeFromPlans(long userId, long userVocabularyId);
}
