package com.vocabflow.push.application;

import java.time.LocalDate;

/** What the reminder needs to know about a study day; implemented by the tasks module. */
public interface ReminderProgress {
  /** True when the day's study plan is finished (the reminder is not sent then). */
  boolean studyDone(long userId, LocalDate date);

  /** The current streak in days. */
  int streak(long userId, LocalDate today);
}
