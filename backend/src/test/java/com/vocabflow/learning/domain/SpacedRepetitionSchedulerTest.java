package com.vocabflow.learning.domain;

import static com.vocabflow.learning.domain.Rating.*;
import static org.assertj.core.api.Assertions.assertThat;

import com.vocabflow.vocabulary.domain.LearningStatus;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class SpacedRepetitionSchedulerTest {
  private static final Instant NOW = Instant.parse("2026-11-01T12:00:00Z");
  private static final LocalDate TODAY = LocalDate.of(2026, 11, 1);

  @ParameterizedTest
  @CsvSource({
    // step, rating, resulting step, minutes until due
    "0, AGAIN, 0, 1",
    "0, HARD, 0, 1",
    "0, GOOD, 1, 10",
    "1, AGAIN, 0, 1",
    "1, HARD, 1, 10",
  })
  void learningStepsStayWithinTheDay(int step, Rating rating, int nextStep, int minutes) {
    ReviewCard next = schedule(learning(step), rating);

    assertThat(next.state()).isEqualTo(CardState.LEARNING);
    assertThat(next.stepIndex()).isEqualTo(nextStep);
    assertThat(next.dueAt()).isEqualTo(NOW.plus(Duration.ofMinutes(minutes)));
    assertThat(next.dueDate()).isNull();
  }

  @Test
  void aNewCardBehavesLikeTheFirstLearningStep() {
    ReviewCard next = schedule(ReviewCard.newCard(), GOOD);

    assertThat(next.state()).isEqualTo(CardState.LEARNING);
    assertThat(next.stepIndex()).isEqualTo(1);
    assertThat(next.reps()).isEqualTo(1);
  }

  @ParameterizedTest
  @CsvSource({
    // step, rating, interval
    "1, GOOD, 1",
    "0, EASY, 4",
    "1, EASY, 4",
  })
  void graduatingMovesTheCardIntoReview(int step, Rating rating, int interval) {
    ReviewCard next = schedule(learning(step), rating);

    assertThat(next.state()).isEqualTo(CardState.REVIEW);
    assertThat(next.intervalDays()).isEqualTo(interval);
    assertThat(next.dueDate()).isEqualTo(TODAY.plusDays(interval));
    assertThat(next.dueAt()).isNull();
    assertThat(next.easePermille()).isEqualTo(2500);
  }

  @ParameterizedTest
  @CsvSource({
    // interval, ease, days late, rating, new interval, new ease
    "10, 2500, 0, HARD, 12, 2350",
    "10, 2500, 0, GOOD, 25, 2500",
    "10, 2500, 0, EASY, 33, 2650",
    // Overdue: a quarter, half and all of the delay count
    "10, 2500, 4, HARD, 13, 2350",
    "10, 2500, 4, GOOD, 30, 2500",
    "10, 2500, 4, EASY, 46, 2650",
    // Each better rating must lengthen the interval, even when the formula would not
    "1, 1300, 0, HARD, 2, 1300",
    "1, 1300, 0, GOOD, 3, 1300",
    "1, 1300, 0, EASY, 4, 1450",
    // Ease stops at the minimum
    "10, 1400, 0, HARD, 12, 1300",
    // Intervals are capped at 100 years
    "30000, 2500, 0, EASY, 36500, 2650",
  })
  void reviewRatingsLengthenTheInterval(
      int interval, int ease, int late, Rating rating, int nextInterval, int nextEase) {
    ReviewCard next = schedule(review(interval, ease, TODAY.minusDays(late)), rating);

    assertThat(next.state()).isEqualTo(CardState.REVIEW);
    assertThat(next.intervalDays()).isEqualTo(nextInterval);
    assertThat(next.easePermille()).isEqualTo(nextEase);
    assertThat(next.dueDate()).isEqualTo(TODAY.plusDays(nextInterval));
    assertThat(next.lapses()).isZero();
  }

  @Test
  void aReviewReviewedEarlyGetsNoNegativeCredit() {
    ReviewCard next = schedule(review(10, 2500, TODAY.plusDays(5)), GOOD);

    assertThat(next.intervalDays()).isEqualTo(25);
  }

  @Test
  void forgettingAReviewCountsALapseAndStartsRelearning() {
    ReviewCard next = schedule(review(30, 2500, TODAY), AGAIN);

    assertThat(next.state()).isEqualTo(CardState.RELEARNING);
    assertThat(next.easePermille()).isEqualTo(2300);
    assertThat(next.lapses()).isEqualTo(1);
    assertThat(next.dueAt()).isEqualTo(NOW.plus(Duration.ofMinutes(10)));
    assertThat(next.dueDate()).isNull();
  }

  @Test
  void forgettingCannotPushEaseBelowTheMinimum() {
    assertThat(schedule(review(30, 1400, TODAY), AGAIN).easePermille()).isEqualTo(1300);
  }

  @ParameterizedTest
  @CsvSource({"AGAIN", "HARD"})
  void relearningStaysOnItsStepWithoutAnotherLapse(Rating rating) {
    ReviewCard next = schedule(schedule(review(30, 2500, TODAY), AGAIN), rating);

    assertThat(next.state()).isEqualTo(CardState.RELEARNING);
    assertThat(next.lapses()).isEqualTo(1);
    assertThat(next.easePermille()).isEqualTo(2300);
    assertThat(next.dueAt()).isEqualTo(NOW.plus(Duration.ofMinutes(10)));
  }

  @ParameterizedTest
  @CsvSource({"GOOD, 1", "EASY, 2"})
  void relearningReturnsToReviewWithAShortInterval(Rating rating, int interval) {
    ReviewCard next = schedule(schedule(review(30, 2500, TODAY), AGAIN), rating);

    assertThat(next.state()).isEqualTo(CardState.REVIEW);
    assertThat(next.intervalDays()).isEqualTo(interval);
    assertThat(next.easePermille()).isEqualTo(2300);
    assertThat(next.dueDate()).isEqualTo(TODAY.plusDays(interval));
  }

  @Test
  void theSameInputAlwaysGivesTheSameResult() {
    ReviewCard card = review(17, 2360, TODAY.minusDays(3));

    assertThat(schedule(card, GOOD)).isEqualTo(schedule(card, GOOD));
  }

  @Test
  void learningStatusFollowsTheCard() {
    assertThat(ReviewCard.newCard().learningStatus()).isEqualTo(LearningStatus.NEW);
    assertThat(learning(0).learningStatus()).isEqualTo(LearningStatus.LEARNING);
    assertThat(schedule(review(30, 2500, TODAY), AGAIN).learningStatus())
        .isEqualTo(LearningStatus.LEARNING);
    assertThat(review(20, 2500, TODAY).learningStatus()).isEqualTo(LearningStatus.FAMILIAR);
    assertThat(review(21, 2500, TODAY).learningStatus()).isEqualTo(LearningStatus.MASTERED);
  }

  @Test
  void aWordRememberedEveryTimeBecomesMasteredOverSuccessiveReviews() {
    ReviewCard card = ReviewCard.newCard();
    LocalDate day = TODAY;
    card = schedule(card, GOOD);
    card = schedule(card, GOOD);
    assertThat(card.learningStatus()).isEqualTo(LearningStatus.FAMILIAR);
    List<Integer> intervals = new ArrayList<>(List.of(card.intervalDays()));
    while (card.learningStatus() != LearningStatus.MASTERED) {
      day = card.dueDate();
      card = SpacedRepetitionScheduler.schedule(card, GOOD, NOW, day);
      intervals.add(card.intervalDays());
    }

    assertThat(intervals).containsExactly(1, 3, 8, 20, 50);
  }

  private static ReviewCard schedule(ReviewCard card, Rating rating) {
    return SpacedRepetitionScheduler.schedule(card, rating, NOW, TODAY);
  }

  private static ReviewCard learning(int step) {
    return new ReviewCard(CardState.LEARNING, step, 0, 2500, NOW, null, 1, 0);
  }

  private static ReviewCard review(int interval, int ease, LocalDate dueDate) {
    return new ReviewCard(CardState.REVIEW, 0, interval, ease, null, dueDate, 5, 0);
  }
}
