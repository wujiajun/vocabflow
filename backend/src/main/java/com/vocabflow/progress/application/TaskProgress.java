package com.vocabflow.progress.application;

import java.time.LocalDate;
import java.util.Map;

/** What the tasks module knows about points and streaks; implemented there. */
public interface TaskProgress {
  /** Points earned per study date in the range (days without any are absent). */
  Map<LocalDate, Integer> pointsByDay(long userId, LocalDate from, LocalDate to);

  /** The streak as the daily tasks count it. */
  Streaks streaks(long userId, LocalDate today);

  record Streaks(int current, int best) {}
}
