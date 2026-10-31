package com.vocabflow.learning.application;

import com.vocabflow.identity.application.UserRepository;
import com.vocabflow.learning.domain.DailyLearningPlan;
import com.vocabflow.learning.domain.DailyLearningPlanItem;
import com.vocabflow.learning.domain.PlanItemType;
import com.vocabflow.shared.web.UnauthorizedException;
import com.vocabflow.vocabulary.application.LearningVocabularyQuery;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Changes a stored plan after it was created. Existing items and their order never change. Each
 * change holds the plan's row lock for its own transaction, so concurrent requests take turns and
 * the later one sees what the earlier one added. These transactions are separate from creating and
 * reloading a plan, whose boundaries must stay as they are.
 */
@Service
public class DailyPlanGrowth {
  private final DailyLearningPlanRepository plans;
  private final UserRepository users;
  private final LearningVocabularyQuery vocabulary;

  public DailyPlanGrowth(
      DailyLearningPlanRepository plans, UserRepository users, LearningVocabularyQuery vocabulary) {
    this.plans = plans;
    this.users = users;
    this.vocabulary = vocabulary;
  }

  /** New words the plan should hold: today's goal, which may have changed, plus extra batches. */
  public int target(DailyLearningPlan plan) {
    return goal(plan.userId()) + plan.extraNewItems();
  }

  public boolean hasNewWordsBeyond(DailyLearningPlan plan) {
    return !candidates(plan, 1).isEmpty();
  }

  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void topUp(long userId, LocalDate date) {
    plans
        .findForUpdate(userId, date)
        .filter(plan -> plan.finishedAt() == null)
        .ifPresent(plan -> fill(plan, target(plan)));
  }

  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void addBatch(long userId, LocalDate date) {
    plans
        .findForUpdate(userId, date)
        .ifPresent(
            plan -> {
              int goal = goal(userId);
              int extra = plan.extraNewItems();
              if (plan.newItems().size() >= goal + extra) {
                extra += goal;
              }
              // With nothing to add, the day stays finished and the batch is not counted.
              if (fill(plan, goal + extra) > 0) {
                plans.updateProgress(userId, date, extra, null);
              }
            });
  }

  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void markFinished(long userId, LocalDate date, Instant at) {
    plans
        .findForUpdate(userId, date)
        .filter(plan -> plan.finishedAt() == null)
        .ifPresent(plan -> plans.updateProgress(userId, date, plan.extraNewItems(), at));
  }

  private int fill(DailyLearningPlan plan, int target) {
    int missing = target - plan.newItems().size();
    if (missing <= 0) {
      return 0;
    }
    List<DailyLearningPlanItem> items =
        candidates(plan, missing).stream()
            .map(
                word ->
                    new DailyLearningPlanItem(
                        word.userVocabularyId(),
                        word.vocabularyItemId(),
                        word.term(),
                        word.type(),
                        PlanItemType.NEW))
            .toList();
    if (!items.isEmpty()) {
      plans.appendNewItems(plan.userId(), plan.learningDate(), items);
    }
    return items.size();
  }

  // Unstudied words already in the plan are still NEW, so ask for enough to skip past them.
  private List<com.vocabflow.vocabulary.domain.LearningVocabulary> candidates(
      DailyLearningPlan plan, int count) {
    Set<Long> inPlan = new HashSet<>();
    plan.newItems().forEach(item -> inPlan.add(item.userVocabularyId()));
    return vocabulary.findNewVocabularyForUser(plan.userId(), inPlan.size() + count).stream()
        .filter(word -> !inPlan.contains(word.userVocabularyId()))
        .limit(count)
        .toList();
  }

  private int goal(long userId) {
    return users
        .findById(userId)
        .orElseThrow(() -> new UnauthorizedException("User no longer exists"))
        .dailyVocabularyGoal()
        .value();
  }
}
