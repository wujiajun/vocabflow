package com.vocabflow.tasks.domain;

import java.time.Instant;

/**
 * One task of a study day, fixed when the day's list is made. {@code param} is the practice game of
 * a {@link TaskType#PLAY_GAME} task, else null.
 */
public record DailyTask(TaskType type, String param, int target, int points, Instant completedAt) {
  public DailyTask {
    if (type == null || target < 1 || points < 1) {
      throw new IllegalArgumentException("A task needs a type, a target and points");
    }
    if (type.needsGame() != (param != null)) {
      throw new IllegalArgumentException("Only a named-game task has a game");
    }
  }

  public String key() {
    return param == null ? type.name() : type.name() + ":" + param;
  }

  public boolean completed() {
    return completedAt != null;
  }

  public DailyTask completedAt(Instant at) {
    return new DailyTask(type, param, target, points, at);
  }
}
