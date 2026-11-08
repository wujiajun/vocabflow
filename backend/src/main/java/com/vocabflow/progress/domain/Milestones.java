package com.vocabflow.progress.domain;

import java.util.List;
import java.util.OptionalInt;

/** The mastered-word goals the learner works towards. */
public final class Milestones {
  public static final List<Integer> GOALS = List.of(50, 100, 250, 500, 1000);

  private Milestones() {}

  /** The first goal above {@code mastered}; empty once the last one is reached. */
  public static OptionalInt next(int mastered) {
    return GOALS.stream().mapToInt(Integer::intValue).filter(g -> g > mastered).findFirst();
  }

  /** The highest goal already reached (0 before the first). */
  public static int previous(int mastered) {
    return GOALS.stream().mapToInt(Integer::intValue).filter(g -> g <= mastered).max().orElse(0);
  }
}
