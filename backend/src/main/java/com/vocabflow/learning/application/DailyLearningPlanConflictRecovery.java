package com.vocabflow.learning.application;

import com.vocabflow.learning.domain.DailyLearningPlan;
import java.time.LocalDate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DailyLearningPlanConflictRecovery {
  private final DailyLearningPlanRepository plans;

  public DailyLearningPlanConflictRecovery(DailyLearningPlanRepository plans) {
    this.plans = plans;
  }

  @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW)
  public DailyLearningPlan reload(long userId, LocalDate learningDate) {
    return plans.findByUserIdAndLearningDate(userId, learningDate).orElseThrow();
  }
}
