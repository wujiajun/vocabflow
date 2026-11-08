package com.vocabflow.tasks.domain;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

/** Streak counting over the days on which the base task was done. */
public final class Streak {
  /** Streak lengths that earn a bonus, each when the run reaches it. */
  public static final List<Integer> BONUS_DAYS = List.of(3, 7, 14, 30);

  private Streak() {}

  /** Length of the run of days ending on {@code day} (0 when {@code day} is not in the set). */
  public static int endingOn(Set<LocalDate> done, LocalDate day) {
    int length = 0;
    for (LocalDate d = day; done.contains(d); d = d.minusDays(1)) {
      length++;
    }
    return length;
  }

  /** The streak as it stands: today's run, or yesterday's while today is still to be done. */
  public static int current(Set<LocalDate> done, LocalDate today) {
    return done.contains(today) ? endingOn(done, today) : endingOn(done, today.minusDays(1));
  }

  public static int best(Set<LocalDate> done) {
    int best = 0;
    int run = 0;
    LocalDate previous = null;
    for (LocalDate day : new TreeSet<>(done)) {
      run = previous != null && previous.plusDays(1).equals(day) ? run + 1 : 1;
      best = Math.max(best, run);
      previous = day;
    }
    return best;
  }
}
