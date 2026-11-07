package com.vocabflow.tasks.infrastructure;

import java.util.List;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Writes a whole day's list in one transaction of its own, so a lost race leaves no rows. */
@Component
public class DailyTaskInsertTransaction {
  private final DailyTaskDayJpaRepository days;
  private final DailyTaskJpaRepository tasks;

  public DailyTaskInsertTransaction(DailyTaskDayJpaRepository days, DailyTaskJpaRepository tasks) {
    this.days = days;
    this.tasks = tasks;
  }

  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void insert(DailyTaskDayEntity day, List<DailyTaskEntity> entities) {
    days.saveAndFlush(day);
    tasks.saveAllAndFlush(entities);
  }
}
