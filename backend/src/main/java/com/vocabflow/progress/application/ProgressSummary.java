package com.vocabflow.progress.application;

import java.time.LocalDate;
import java.util.List;

/** The learner's progress as of one study day. */
public record ProgressSummary(
    LocalDate date,
    int started,
    int mastered,
    int learning,
    int streak,
    int bestStreak,
    Milestone milestone,
    List<Day> days,
    Week thisWeek,
    Week lastWeek) {
  /** {@code next} is null once the last goal is reached. */
  public record Milestone(int previous, Integer next) {}

  public record Day(LocalDate date, int cards, int reviews, int newWords, int rounds, int points) {}

  /** Seven study days: {@code thisWeek} ends on the date, {@code lastWeek} on the week before. */
  public record Week(int reviews, int newWords, int rounds) {}
}
