package com.vocabflow.learning.infrastructure;

import com.vocabflow.vocabulary.application.StudyRecords;
import org.springframework.stereotype.Component;

@Component
public class JpaStudyRecords implements StudyRecords {
  private final LearningCardJpaRepository cards;
  private final ReviewLogJpaRepository logs;
  private final DailyLearningPlanItemJpaRepository planItems;

  public JpaStudyRecords(
      LearningCardJpaRepository cards,
      ReviewLogJpaRepository logs,
      DailyLearningPlanItemJpaRepository planItems) {
    this.cards = cards;
    this.logs = logs;
    this.planItems = planItems;
  }

  @Override
  public boolean hasHistory(long userId, long userVocabularyId) {
    return cards.existsByUserIdAndUserVocabularyId(userId, userVocabularyId)
        || logs.existsByUserIdAndUserVocabularyId(userId, userVocabularyId);
  }

  @Override
  public void removeFromPlans(long userId, long userVocabularyId) {
    planItems.deleteForWord(userId, userVocabularyId);
  }
}
