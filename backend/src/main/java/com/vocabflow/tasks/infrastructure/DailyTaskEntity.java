package com.vocabflow.tasks.infrastructure;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(
    name = "daily_tasks",
    uniqueConstraints =
        @UniqueConstraint(
            name = "uk_daily_tasks_user_date_key",
            columnNames = {"user_id", "study_date", "task_key"}))
public class DailyTaskEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @Column(name = "user_id", nullable = false)
  public Long userId;

  @Column(name = "study_date", nullable = false)
  public LocalDate studyDate;

  @Column(nullable = false)
  public int position;

  @Column(name = "task_key", nullable = false, length = 40)
  public String taskKey;

  @Column(name = "task_type", nullable = false, length = 30)
  public String taskType;

  @Column(nullable = false, length = 20)
  public String category;

  @Column(length = 20)
  public String param;

  @Column(nullable = false)
  public int target;

  @Column(nullable = false)
  public int points;

  @Column(name = "completed_at")
  public Instant completedAt;
}
