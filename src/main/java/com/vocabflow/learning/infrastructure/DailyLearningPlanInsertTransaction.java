package com.vocabflow.learning.infrastructure;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Component
public class DailyLearningPlanInsertTransaction {
  private final DailyLearningPlanJpaRepository plans;

  public DailyLearningPlanInsertTransaction(DailyLearningPlanJpaRepository plans) {
    this.plans = plans;
  }

  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public DailyLearningPlanEntity insert(DailyLearningPlanEntity plan) {
    return plans.saveAndFlush(plan);
  }
}
