package com.vocabflow.learning.domain;

import java.time.*;
import java.util.*;

public record DailyLearningPlan(
    long id,
    long userId,
    LocalDate learningDate,
    int newVocabularyGoal,
    Instant createdAt,
    List<DailyLearningPlanItem> newItems,
    List<DailyLearningPlanItem> reviewItems,
    int extraNewItems,
    Instant finishedAt) {
  public DailyLearningPlan(
      long id,
      long userId,
      LocalDate learningDate,
      int newVocabularyGoal,
      Instant createdAt,
      List<DailyLearningPlanItem> newItems,
      List<DailyLearningPlanItem> reviewItems) {
    this(id, userId, learningDate, newVocabularyGoal, createdAt, newItems, reviewItems, 0, null);
  }

  public DailyLearningPlan {
    newItems = List.copyOf(newItems);
    reviewItems = List.copyOf(reviewItems);
    Set<Long> selectedVocabulary = new HashSet<>();
    for (DailyLearningPlanItem item : newItems) {
      if (item.itemType() != PlanItemType.NEW || !selectedVocabulary.add(item.userVocabularyId())) {
        throw new IllegalArgumentException("Plan items must be unique NEW vocabulary");
      }
    }
    for (DailyLearningPlanItem item : reviewItems) {
      if (item.itemType() != PlanItemType.REVIEW
          || !selectedVocabulary.add(item.userVocabularyId())) {
        throw new IllegalArgumentException("Plan items must be unique REVIEW vocabulary");
      }
    }
  }
}
