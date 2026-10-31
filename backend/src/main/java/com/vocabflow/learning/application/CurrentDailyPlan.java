package com.vocabflow.learning.application;

import com.vocabflow.learning.domain.DailyLearningPlan;
import java.time.LocalDate;
import org.springframework.stereotype.Service;

/**
 * The plan to show for a day: the stored plan, topped up with words added since it was created.
 * Deliberately not transactional: creating a plan and growing it each manage their own.
 */
@Service
public class CurrentDailyPlan {
  private final DailyLearningPlanService plans;
  private final DailyPlanGrowth growth;
  private final DailyLearningPlanRepository repository;

  public CurrentDailyPlan(
      DailyLearningPlanService plans,
      DailyPlanGrowth growth,
      DailyLearningPlanRepository repository) {
    this.plans = plans;
    this.growth = growth;
    this.repository = repository;
  }

  public DailyLearningPlan get(long userId, LocalDate requestedDate) {
    DailyLearningPlan plan = plans.getOrCreate(userId, requestedDate);
    boolean stored = plan.id() != 0;
    if (!stored
        || plan.finishedAt() != null
        || plan.newItems().size() >= growth.target(plan)
        || !growth.hasNewWordsBeyond(plan)) {
      return plan;
    }
    growth.topUp(userId, plan.learningDate());
    return repository.findByUserIdAndLearningDate(userId, plan.learningDate()).orElseThrow();
  }
}
