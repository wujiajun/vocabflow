package com.vocabflow.learning.application;

import com.vocabflow.learning.domain.DailyLearningPlan;
import com.vocabflow.learning.domain.DailyLearningPlanItem;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface DailyLearningPlanRepository {
  Optional<DailyLearningPlan> findByUserIdAndLearningDate(long userId, LocalDate learningDate);

  Optional<DailyLearningPlan> saveIfAbsent(DailyLearningPlan plan);

  /** Locks the plan until the surrounding transaction ends, so changes to it take turns. */
  Optional<DailyLearningPlan> findForUpdate(long userId, LocalDate learningDate);

  /** Adds new words after the plan's existing items, whose order does not change. */
  void appendNewItems(long userId, LocalDate learningDate, List<DailyLearningPlanItem> items);

  void updateProgress(long userId, LocalDate learningDate, int extraNewItems, Instant finishedAt);
}
