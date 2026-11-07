package com.vocabflow.tasks.application;

import com.vocabflow.tasks.domain.DailyTask;
import com.vocabflow.tasks.domain.TaskCategory;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** The stored task lists of the users' study days. */
public interface DailyTaskStore {
  /** The day's tasks in their order; empty when the list has not been made. */
  List<DailyTask> find(long userId, LocalDate date);

  /**
   * Stores the whole list or nothing; false when the day already has one. Catches a duplicate-key
   * error, so it must not run inside a shared transaction.
   */
  boolean saveIfAbsent(long userId, LocalDate date, List<DailyTask> tasks);

  /** Marks the task done; does nothing when it already is. */
  void markCompleted(long userId, LocalDate date, String key, Instant at);

  /** For each category, the last day before {@code before} on which a task of it was completed. */
  Map<TaskCategory, LocalDate> lastCompleted(long userId, LocalDate before);

  /** The days on which the base task was completed. */
  Set<LocalDate> baseCompletedDays(long userId);
}
