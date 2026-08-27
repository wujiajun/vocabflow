package com.vocabflow.identity.domain;

public record DailyVocabularyGoal(int value) {
  public DailyVocabularyGoal {
    if (value < 1 || value > 100)
      throw new IllegalArgumentException("Daily goal must be between 1 and 100");
  }
}
