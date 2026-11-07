package com.vocabflow.tasks.application;

import com.vocabflow.tasks.domain.DailyTask;
import java.time.LocalDate;
import java.util.List;

/** A study day's tasks with progress, and the user's points and streak. */
public record TaskDay(
    LocalDate date,
    List<Item> tasks,
    boolean allDone,
    int earnedToday,
    int balance,
    int streak,
    int bestStreak) {
  public record Item(DailyTask task, int current) {}
}
