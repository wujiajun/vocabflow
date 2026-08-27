package com.vocabflow.learning.application;

import com.vocabflow.learning.domain.DailyLearningPlan;
import java.time.LocalDate;
import java.util.Optional;

public interface DailyLearningPlanRepository {
  Optional<DailyLearningPlan> findByUserIdAndLearningDate(long userId, LocalDate learningDate);

  Optional<DailyLearningPlan> saveIfAbsent(DailyLearningPlan plan);
}
