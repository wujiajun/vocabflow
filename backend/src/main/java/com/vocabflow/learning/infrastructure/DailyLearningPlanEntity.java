package com.vocabflow.learning.infrastructure;

import jakarta.persistence.*;
import java.time.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(
    name = "daily_learning_plans",
    uniqueConstraints =
        @UniqueConstraint(
            name = "uk_daily_plan_user_date",
            columnNames = {"user_id", "learning_date"}))
public class DailyLearningPlanEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @Column(name = "user_id", nullable = false)
  public Long userId;

  @Column(name = "learning_date", nullable = false)
  public LocalDate learningDate;

  @Column(name = "new_vocabulary_goal", nullable = false)
  public int newVocabularyGoal;

  @Column(name = "created_at", nullable = false)
  public Instant createdAt;

  @OneToMany(
      mappedBy = "plan",
      cascade = CascadeType.ALL,
      orphanRemoval = true,
      fetch = FetchType.EAGER)
  public List<DailyLearningPlanItemEntity> items = new ArrayList<>();
}
