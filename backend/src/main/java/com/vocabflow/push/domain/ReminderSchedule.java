package com.vocabflow.push.domain;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;

/** When a reminder is due: once a day, from the chosen time on, never long after it. */
public final class ReminderSchedule {
  /**
   * A reminder this long after its time is dropped (the server was down), not sent late at night.
   */
  public static final Duration WINDOW = Duration.ofHours(3);

  private ReminderSchedule() {}

  /** The local date a reminder is due for now, or null when it is not due. */
  public static LocalDate dueDate(
      LocalTime remindAt, ZoneId zone, Instant now, LocalDate lastSentDate) {
    var local = now.atZone(zone);
    LocalDate today = local.toLocalDate();
    if (today.equals(lastSentDate)) {
      return null;
    }
    Duration late = Duration.between(remindAt, local.toLocalTime());
    if (late.isNegative() || late.compareTo(WINDOW) >= 0) {
      return null;
    }
    return today;
  }

  /** The date to record when the reminder is switched on, so that it does not fire at once. */
  public static LocalDate alreadyPast(LocalTime remindAt, ZoneId zone, Instant now) {
    var local = now.atZone(zone);
    return local.toLocalTime().isBefore(remindAt) ? null : local.toLocalDate();
  }
}
