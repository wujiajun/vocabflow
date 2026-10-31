package com.vocabflow.learning.domain;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * SM-2 as Anki applies it, with Anki's default settings. Deliberately has no random interval fuzz,
 * so the same card and rating always give the same result.
 */
public final class SpacedRepetitionScheduler {
  static final List<Duration> LEARNING_STEPS =
      List.of(Duration.ofMinutes(1), Duration.ofMinutes(10));
  static final Duration RELEARNING_STEP = Duration.ofMinutes(10);
  static final int GRADUATING_INTERVAL_DAYS = 1;
  static final int EASY_INTERVAL_DAYS = 4;
  // A forgotten word starts its reviews over, as with Anki's default "new interval" of 0%.
  static final int RELEARNED_INTERVAL_DAYS = 1;
  static final int MINIMUM_EASE = 1300;
  static final int MAXIMUM_INTERVAL_DAYS = 36500;
  static final double HARD_MULTIPLIER = 1.2;
  static final double EASY_BONUS = 1.3;

  private SpacedRepetitionScheduler() {}

  public static ReviewCard schedule(ReviewCard card, Rating rating, Instant now, LocalDate today) {
    return switch (card.state()) {
      case NEW, LEARNING -> learning(card, rating, now, today);
      case REVIEW -> review(card, rating, now, today);
      case RELEARNING -> relearning(card, rating, now, today);
    };
  }

  private static ReviewCard learning(ReviewCard card, Rating rating, Instant now, LocalDate today) {
    return switch (rating) {
      case AGAIN -> inLearning(card, 0, now);
      case HARD -> inLearning(card, card.stepIndex(), now);
      case GOOD ->
          card.stepIndex() + 1 < LEARNING_STEPS.size()
              ? inLearning(card, card.stepIndex() + 1, now)
              : inReview(card, GRADUATING_INTERVAL_DAYS, card.easePermille(), card.lapses(), today);
      case EASY -> inReview(card, EASY_INTERVAL_DAYS, card.easePermille(), card.lapses(), today);
    };
  }

  private static ReviewCard review(ReviewCard card, Rating rating, Instant now, LocalDate today) {
    int interval = card.intervalDays();
    int ease = card.easePermille();
    long daysLate = Math.max(0, ChronoUnit.DAYS.between(card.dueDate(), today));
    double factor = ease / 1000.0;
    // Waiting longer than planned and still remembering is evidence for a longer interval. Harder
    // ratings get less of that credit. Each better rating must lengthen the interval.
    int hard = Math.max(interval + 1, days((interval + daysLate / 4.0) * HARD_MULTIPLIER));
    int good = Math.max(hard + 1, days((interval + daysLate / 2.0) * factor));
    int easy = Math.max(good + 1, days((interval + daysLate) * factor * EASY_BONUS));
    return switch (rating) {
      case AGAIN ->
          new ReviewCard(
              CardState.RELEARNING,
              0,
              interval,
              Math.max(MINIMUM_EASE, ease - 200),
              now.plus(RELEARNING_STEP),
              null,
              card.reps() + 1,
              card.lapses() + 1);
      case HARD -> inReview(card, hard, Math.max(MINIMUM_EASE, ease - 150), card.lapses(), today);
      case GOOD -> inReview(card, good, ease, card.lapses(), today);
      case EASY -> inReview(card, easy, ease + 150, card.lapses(), today);
    };
  }

  private static ReviewCard relearning(
      ReviewCard card, Rating rating, Instant now, LocalDate today) {
    return switch (rating) {
      case AGAIN, HARD ->
          new ReviewCard(
              CardState.RELEARNING,
              0,
              card.intervalDays(),
              card.easePermille(),
              now.plus(RELEARNING_STEP),
              null,
              card.reps() + 1,
              card.lapses());
      case GOOD ->
          inReview(card, RELEARNED_INTERVAL_DAYS, card.easePermille(), card.lapses(), today);
      case EASY ->
          inReview(card, RELEARNED_INTERVAL_DAYS + 1, card.easePermille(), card.lapses(), today);
    };
  }

  private static ReviewCard inLearning(ReviewCard card, int step, Instant now) {
    return new ReviewCard(
        CardState.LEARNING,
        step,
        0,
        card.easePermille(),
        now.plus(LEARNING_STEPS.get(step)),
        null,
        card.reps() + 1,
        card.lapses());
  }

  private static ReviewCard inReview(
      ReviewCard card, int interval, int ease, int lapses, LocalDate today) {
    int capped = Math.min(interval, MAXIMUM_INTERVAL_DAYS);
    return new ReviewCard(
        CardState.REVIEW, 0, capped, ease, null, today.plusDays(capped), card.reps() + 1, lapses);
  }

  private static int days(double value) {
    return (int) Math.min(MAXIMUM_INTERVAL_DAYS, Math.round(value));
  }
}
