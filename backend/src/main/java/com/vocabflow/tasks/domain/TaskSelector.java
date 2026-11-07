package com.vocabflow.tasks.domain;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * Chooses the variable tasks of a day. Deterministic for a user and date: the same inputs give the
 * same list, so every device sees the same tasks. A category the user has not completed a task of
 * for longer is more likely; no category is picked twice.
 */
public final class TaskSelector {
  /** Days without a task of a category are counted up to this many. */
  static final int MAX_DAYS_WEIGHT = 14;

  private TaskSelector() {}

  /**
   * @param lastDone for each category, the last earlier day a task of it was completed
   */
  public static List<DailyTask> select(
      long userId,
      LocalDate date,
      List<TaskRules.Candidate> candidates,
      Map<TaskCategory, LocalDate> lastDone,
      int count) {
    Random random = new Random(seed(userId, date));
    Map<TaskCategory, List<TaskRules.Candidate>> byCategory = new EnumMap<>(TaskCategory.class);
    for (TaskRules.Candidate candidate : candidates) {
      byCategory
          .computeIfAbsent(candidate.type().category(), c -> new ArrayList<>())
          .add(candidate);
    }
    List<DailyTask> chosen = new ArrayList<>();
    while (chosen.size() < count && !byCategory.isEmpty()) {
      List<TaskCategory> categories = new ArrayList<>(byCategory.keySet());
      int[] weights = categories.stream().mapToInt(c -> weight(date, lastDone.get(c))).toArray();
      TaskCategory category = categories.get(pickIndex(random, weights));
      List<TaskRules.Candidate> options = byCategory.remove(category);
      TaskRules.Candidate pick = options.get(random.nextInt(options.size()));
      String game =
          pick.type().needsGame()
              ? TaskRules.GAMES.get(random.nextInt(TaskRules.GAMES.size()))
              : null;
      chosen.add(new DailyTask(pick.type(), game, pick.target(), pick.type().points(), null));
    }
    return chosen;
  }

  /** 1 for a category done today or yesterday, up to 15 for one never done or not for 14 days. */
  static int weight(LocalDate date, LocalDate last) {
    if (last == null) {
      return MAX_DAYS_WEIGHT + 1;
    }
    long days = Math.max(0, date.toEpochDay() - last.toEpochDay());
    return 1 + (int) Math.min(MAX_DAYS_WEIGHT, days - 1 < 0 ? 0 : days - 1);
  }

  static long seed(long userId, LocalDate date) {
    return userId * 1_000_003L + date.toEpochDay() * 7_919L + 17;
  }

  private static int pickIndex(Random random, int[] weights) {
    int total = 0;
    for (int w : weights) {
      total += w;
    }
    int roll = random.nextInt(total);
    for (int i = 0; i < weights.length; i++) {
      roll -= weights[i];
      if (roll < 0) {
        return i;
      }
    }
    return weights.length - 1;
  }
}
