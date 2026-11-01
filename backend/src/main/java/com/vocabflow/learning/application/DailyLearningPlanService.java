package com.vocabflow.learning.application;

import com.vocabflow.identity.application.UserRepository;
import com.vocabflow.learning.domain.*;
import com.vocabflow.shared.web.UnauthorizedException;
import com.vocabflow.vocabulary.application.LearningVocabularyQuery;
import java.time.*;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DailyLearningPlanService {
  private final DailyLearningPlanRepository plans;
  private final UserRepository users;
  private final LearningVocabularyQuery vocabulary;
  private final DueReviewProvider reviews;
  private final DailyLearningPlanConflictRecovery conflictRecovery;
  private final Clock clock;

  public DailyLearningPlanService(
      DailyLearningPlanRepository plans,
      UserRepository users,
      LearningVocabularyQuery vocabulary,
      DueReviewProvider reviews,
      DailyLearningPlanConflictRecovery conflictRecovery,
      Clock clock) {
    this.plans = plans;
    this.users = users;
    this.vocabulary = vocabulary;
    this.reviews = reviews;
    this.conflictRecovery = conflictRecovery;
    this.clock = clock;
  }

  @Transactional(readOnly = true)
  public DailyLearningPlan getOrCreate(long userId, LocalDate requestedDate) {
    LocalDate learningDate = requestedDate == null ? userToday(userId) : requestedDate;
    return plans
        .findByUserIdAndLearningDate(userId, learningDate)
        .orElseGet(() -> createOrLoadExisting(userId, learningDate));
  }

  // Clients send the date; without one, today is the user's own day, not the server's.
  private LocalDate userToday(long userId) {
    ZoneId zone =
        users.findById(userId).map(user -> user.timeZone()).filter(Objects::nonNull).orElse(null);
    return LocalDate.now(zone == null ? clock : clock.withZone(zone));
  }

  private DailyLearningPlan createOrLoadExisting(long userId, LocalDate learningDate) {
    int goal =
        users
            .findById(userId)
            .orElseThrow(() -> new UnauthorizedException("User no longer exists"))
            .dailyVocabularyGoal()
            .value();
    List<DailyLearningPlanItem> newItems =
        vocabulary.findNewVocabularyForUser(userId, goal).stream()
            .map(
                item ->
                    new DailyLearningPlanItem(
                        item.userVocabularyId(),
                        item.vocabularyItemId(),
                        item.term(),
                        item.type(),
                        PlanItemType.NEW))
            .toList();
    List<DailyLearningPlanItem> reviewItems =
        reviews.findDueReviews(userId, learningDate).stream()
            .map(
                item ->
                    new DailyLearningPlanItem(
                        item.userVocabularyId(),
                        item.vocabularyItemId(),
                        item.term(),
                        item.type(),
                        PlanItemType.REVIEW))
            .toList();
    DailyLearningPlan plan =
        new DailyLearningPlan(
            0, userId, learningDate, goal, Instant.now(clock), newItems, reviewItems);
    // An empty plan is not stored: words added later today can still start a plan for today.
    if (newItems.isEmpty() && reviewItems.isEmpty()) {
      return plan;
    }
    return plans.saveIfAbsent(plan).orElseGet(() -> conflictRecovery.reload(userId, learningDate));
  }
}
