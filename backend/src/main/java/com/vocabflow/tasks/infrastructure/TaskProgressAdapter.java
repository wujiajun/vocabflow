package com.vocabflow.tasks.infrastructure;

import com.vocabflow.progress.application.TaskProgress;
import com.vocabflow.tasks.application.DailyTaskStore;
import com.vocabflow.tasks.domain.Streak;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

/** Gives the progress page the points and the streak, counted the way the daily tasks count. */
@Component
public class TaskProgressAdapter implements TaskProgress {
  private final PointLedgerJpaRepository ledger;
  private final DailyTaskStore store;

  public TaskProgressAdapter(PointLedgerJpaRepository ledger, DailyTaskStore store) {
    this.ledger = ledger;
    this.store = store;
  }

  @Override
  public Map<LocalDate, Integer> pointsByDay(long userId, LocalDate from, LocalDate to) {
    Map<LocalDate, Integer> result = new HashMap<>();
    ledger
        .sumByDay(userId, from, to)
        .forEach(r -> result.put((LocalDate) r[0], ((Number) r[1]).intValue()));
    return result;
  }

  @Override
  public Streaks streaks(long userId, LocalDate today) {
    Set<LocalDate> days = store.baseCompletedDays(userId);
    return new Streaks(Streak.current(days, today), Streak.best(days));
  }
}
