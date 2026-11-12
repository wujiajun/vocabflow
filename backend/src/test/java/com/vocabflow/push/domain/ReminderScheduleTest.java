package com.vocabflow.push.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;

class ReminderScheduleTest {
  private static final LocalTime SEVEN_PM = LocalTime.of(19, 0);
  private static final ZoneId VANCOUVER = ZoneId.of("Etc/GMT+8");

  @Test
  void dueFromTheChosenTimeInTheUsersOwnZone() {
    // 2026-11-10 19:00 at UTC-8 (UTC-8) is 03:00 UTC on the 11th.
    Instant at = Instant.parse("2026-11-11T03:00:00Z");

    assertThat(ReminderSchedule.dueDate(SEVEN_PM, VANCOUVER, at, null))
        .isEqualTo(LocalDate.of(2026, 11, 10));
    assertThat(ReminderSchedule.dueDate(SEVEN_PM, VANCOUVER, at.minusSeconds(1), null)).isNull();
    // In UTC the same instant is 03:00, long before 19:00.
    assertThat(ReminderSchedule.dueDate(SEVEN_PM, ZoneId.of("UTC"), at, null)).isNull();
  }

  @Test
  void onlyOncePerLocalDay() {
    Instant at = Instant.parse("2026-11-11T03:30:00Z");

    assertThat(ReminderSchedule.dueDate(SEVEN_PM, VANCOUVER, at, LocalDate.of(2026, 11, 10)))
        .isNull();
    assertThat(ReminderSchedule.dueDate(SEVEN_PM, VANCOUVER, at, LocalDate.of(2026, 11, 9)))
        .isEqualTo(LocalDate.of(2026, 11, 10));
  }

  @Test
  void aReminderTooLongAfterItsTimeIsDropped() {
    Instant late = Instant.parse("2026-11-11T06:00:00Z"); // 22:00 local, three hours after

    assertThat(ReminderSchedule.dueDate(SEVEN_PM, VANCOUVER, late, null)).isNull();
    assertThat(ReminderSchedule.dueDate(SEVEN_PM, VANCOUVER, late.minusSeconds(1), null))
        .isNotNull();
  }

  @Test
  void switchingOnAfterTheTimeCountsTodayAsSent() {
    Instant after = Instant.parse("2026-11-11T03:30:00Z");
    Instant before = Instant.parse("2026-11-11T01:00:00Z");

    assertThat(ReminderSchedule.alreadyPast(SEVEN_PM, VANCOUVER, after))
        .isEqualTo(LocalDate.of(2026, 11, 10));
    assertThat(ReminderSchedule.alreadyPast(SEVEN_PM, VANCOUVER, before)).isNull();
  }
}
