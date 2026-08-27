package com.vocabflow.learning.adapter;

import com.vocabflow.learning.application.DailyLearningPlanService;
import com.vocabflow.learning.domain.*;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/learning/daily-plan")
public class DailyLearningPlanController {
  private final DailyLearningPlanService plans;

  public DailyLearningPlanController(DailyLearningPlanService plans) {
    this.plans = plans;
  }

  record PlanItem(long userVocabularyId, long vocabularyItemId, String term, String type) {}

  record PlanResponse(
      LocalDate date, int newVocabularyGoal, List<PlanItem> newItems, List<PlanItem> reviewItems) {}

  @GetMapping
  public PlanResponse getDailyPlan(
      @AuthenticationPrincipal Long userId,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
          LocalDate date) {
    DailyLearningPlan plan = plans.getOrCreate(userId, date);
    return new PlanResponse(
        plan.learningDate(),
        plan.newVocabularyGoal(),
        plan.newItems().stream().map(this::map).toList(),
        plan.reviewItems().stream().map(this::map).toList());
  }

  private PlanItem map(DailyLearningPlanItem item) {
    return new PlanItem(
        item.userVocabularyId(),
        item.vocabularyItemId(),
        item.term(),
        item.type() == null ? null : item.type().name());
  }
}
