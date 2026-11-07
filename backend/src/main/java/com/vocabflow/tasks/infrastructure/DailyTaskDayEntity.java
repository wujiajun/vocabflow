package com.vocabflow.tasks.infrastructure;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;

/** Marks that a user's study day has its task list; its unique key elects the writer. */
@Entity
@Table(
    name = "daily_task_days",
    uniqueConstraints =
        @UniqueConstraint(
            name = "uk_daily_task_days_user_date",
            columnNames = {"user_id", "study_date"}))
public class DailyTaskDayEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @Column(name = "user_id", nullable = false)
  public Long userId;

  @Column(name = "study_date", nullable = false)
  public LocalDate studyDate;

  @Column(name = "created_at", nullable = false)
  public Instant createdAt;
}
