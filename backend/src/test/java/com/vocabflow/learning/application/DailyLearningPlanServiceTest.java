package com.vocabflow.learning.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.vocabflow.identity.application.UserRepository;
import com.vocabflow.identity.domain.*;
import com.vocabflow.learning.domain.*;
import com.vocabflow.vocabulary.application.LearningVocabularyQuery;
import com.vocabflow.vocabulary.domain.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class DailyLearningPlanServiceTest {
  private final DailyLearningPlanRepository plans = mock(DailyLearningPlanRepository.class);
  private final UserRepository users = mock(UserRepository.class);
  private final LearningVocabularyQuery vocabulary = mock(LearningVocabularyQuery.class);
  private final DueReviewProvider reviews = mock(DueReviewProvider.class);
  private final DailyLearningPlanConflictRecovery conflictRecovery =
      mock(DailyLearningPlanConflictRecovery.class);
  private final Clock clock = Clock.fixed(Instant.parse("2026-08-25T10:00:00Z"), ZoneOffset.UTC);
  private final DailyLearningPlanService service =
      new DailyLearningPlanService(plans, users, vocabulary, reviews, conflictRecovery, clock);

  @Test
  void createsPlanUsingGoalOldestNewVocabularyAndNoReviews() {
    when(users.findById(7L)).thenReturn(Optional.of(user(7L, 2)));
    when(vocabulary.findNewVocabularyForUser(7L, 2))
        .thenReturn(List.of(candidate(10L, "first"), candidate(11L, "second")));
    when(reviews.findDueReviews(7L, LocalDate.of(2026, 8, 25))).thenReturn(List.of());
    when(plans.saveIfAbsent(any(DailyLearningPlan.class)))
        .thenAnswer(invocation -> Optional.of(invocation.getArgument(0)));

    DailyLearningPlan plan = service.getOrCreate(7L, null);

    assertThat(plan.learningDate()).isEqualTo(LocalDate.of(2026, 8, 25));
    assertThat(plan.newVocabularyGoal()).isEqualTo(2);
    assertThat(plan.newItems())
        .extracting(DailyLearningPlanItem::userVocabularyId)
        .containsExactly(10L, 11L);
    assertThat(plan.reviewItems()).isEmpty();
    verify(vocabulary).findNewVocabularyForUser(7L, 2);
    verifyNoInteractions(conflictRecovery);
  }

  @Test
  void returnsExistingPlanWithoutReselectingVocabulary() {
    DailyLearningPlan existing =
        new DailyLearningPlan(
            9, 7, LocalDate.of(2026, 8, 26), 2, clock.instant(), List.of(), List.of());
    when(plans.findByUserIdAndLearningDate(7L, existing.learningDate()))
        .thenReturn(Optional.of(existing));

    assertThat(service.getOrCreate(7L, existing.learningDate())).isEqualTo(existing);
    verifyNoInteractions(users, vocabulary, reviews, conflictRecovery);
  }

  @Test
  void reloadsPersistedPlanWhenConcurrentCreationWinsDatabaseRace() {
    LocalDate date = LocalDate.of(2026, 8, 27);
    DailyLearningPlan persisted =
        new DailyLearningPlan(10, 7, date, 2, clock.instant(), List.of(), List.of());
    when(plans.findByUserIdAndLearningDate(7L, date)).thenReturn(Optional.empty());
    when(users.findById(7L)).thenReturn(Optional.of(user(7L, 2)));
    when(vocabulary.findNewVocabularyForUser(7L, 2)).thenReturn(List.of(candidate(10L, "first")));
    when(reviews.findDueReviews(7L, date)).thenReturn(List.of());
    when(plans.saveIfAbsent(any(DailyLearningPlan.class))).thenReturn(Optional.empty());
    when(conflictRecovery.reload(7L, date)).thenReturn(persisted);

    assertThat(service.getOrCreate(7L, date)).isEqualTo(persisted);
    verify(conflictRecovery).reload(7L, date);
  }

  @Test
  void doesNotStoreAnEmptyPlanSoWordsAddedLaterCanStillStartOne() {
    LocalDate date = LocalDate.of(2026, 8, 28);
    when(plans.findByUserIdAndLearningDate(7L, date)).thenReturn(Optional.empty());
    when(users.findById(7L)).thenReturn(Optional.of(user(7L, 2)));
    when(vocabulary.findNewVocabularyForUser(7L, 2)).thenReturn(List.of());
    when(reviews.findDueReviews(7L, date)).thenReturn(List.of());

    DailyLearningPlan plan = service.getOrCreate(7L, date);

    assertThat(plan.newItems()).isEmpty();
    assertThat(plan.learningDate()).isEqualTo(date);
    verify(plans, never()).saveIfAbsent(any(DailyLearningPlan.class));
  }

  @Test
  void storesAPlanThatHasOnlyReviews() {
    LocalDate date = LocalDate.of(2026, 8, 29);
    when(plans.findByUserIdAndLearningDate(7L, date)).thenReturn(Optional.empty());
    when(users.findById(7L)).thenReturn(Optional.of(user(7L, 2)));
    when(vocabulary.findNewVocabularyForUser(7L, 2)).thenReturn(List.of());
    when(reviews.findDueReviews(7L, date))
        .thenReturn(List.of(new ReviewCandidate(10L, 110L, "due", VocabularyType.WORD)));
    when(plans.saveIfAbsent(any(DailyLearningPlan.class)))
        .thenAnswer(invocation -> Optional.of(invocation.getArgument(0)));

    assertThat(service.getOrCreate(7L, date).reviewItems())
        .extracting(DailyLearningPlanItem::term)
        .containsExactly("due");
  }

  private User user(long id, int goal) {
    return new User(
        id,
        new Email("learner@example.com"),
        "hash",
        ClbLevel.CLB_5,
        new DailyVocabularyGoal(goal),
        clock.instant());
  }

  private LearningVocabulary candidate(long id, String term) {
    return new LearningVocabulary(id, id + 100, term, VocabularyType.WORD, clock.instant());
  }
}
