package com.vocabflow.learning.domain;

import com.vocabflow.vocabulary.domain.LearningStatus;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Scheduling state of one word for one user. Minute-long steps are absolute ({@code dueAt}); review
 * intervals count the learner's own days ({@code dueDate}). Ease is in permille, as Anki stores it,
 * so repeated changes do not accumulate floating point error.
 */
public record ReviewCard(
    CardState state,
    int stepIndex,
    int intervalDays,
    int easePermille,
    Instant dueAt,
    LocalDate dueDate,
    int reps,
    int lapses) {
  public static final int STARTING_EASE = 2500;
  public static final int MATURE_INTERVAL_DAYS = 21;

  public static ReviewCard newCard() {
    return new ReviewCard(CardState.NEW, 0, 0, STARTING_EASE, null, null, 0, 0);
  }

  public LearningStatus learningStatus() {
    return switch (state) {
      case NEW -> LearningStatus.NEW;
      case LEARNING, RELEARNING -> LearningStatus.LEARNING;
      case REVIEW ->
          intervalDays >= MATURE_INTERVAL_DAYS ? LearningStatus.MASTERED : LearningStatus.FAMILIAR;
    };
  }
}
