package com.vocabflow.learning.infrastructure;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "learning_cards")
public class LearningCardEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @Column(name = "user_id", nullable = false)
  public Long userId;

  @Column(name = "user_vocabulary_id", nullable = false, unique = true)
  public Long userVocabularyId;

  @Column(nullable = false)
  public String state;

  @Column(name = "step_index", nullable = false)
  public int stepIndex;

  @Column(name = "interval_days", nullable = false)
  public int intervalDays;

  @Column(name = "ease_permille", nullable = false)
  public int easePermille;

  @Column(name = "due_at")
  public Instant dueAt;

  @Column(name = "due_date")
  public LocalDate dueDate;

  @Column(nullable = false)
  public int reps;

  @Column(nullable = false)
  public int lapses;

  @Version
  @Column(nullable = false)
  public int version;

  @Column(name = "created_at", nullable = false)
  public Instant createdAt;
}
