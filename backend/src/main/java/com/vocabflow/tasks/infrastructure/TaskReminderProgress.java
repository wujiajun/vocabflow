package com.vocabflow.tasks.infrastructure;

import com.vocabflow.push.application.ReminderProgress;
import com.vocabflow.tasks.application.DailyTaskStore;
import com.vocabflow.tasks.application.LearningActivity;
import com.vocabflow.tasks.domain.Streak;
import java.time.LocalDate;
import org.springframework.stereotype.Component;

/** Tells the reminder whether the day's study is done and how long the streak is. */
@Component
public class TaskReminderProgress implements ReminderProgress {
  private final LearningActivity learning;
  private final DailyTaskStore store;

  public TaskReminderProgress(LearningActivity learning, DailyTaskStore store) {
    this.learning = learning;
    this.store = store;
  }

  @Override
  public boolean studyDone(long userId, LocalDate date) {
    return learning.planFinished(userId, date);
  }

  @Override
  public int streak(long userId, LocalDate today) {
    return Streak.current(store.baseCompletedDays(userId), today);
  }
}
