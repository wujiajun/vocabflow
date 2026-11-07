package com.vocabflow.learning.infrastructure;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "game_rounds")
public class GameRoundEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @Column(name = "user_id", nullable = false)
  public Long userId;

  @Column(nullable = false, length = 20)
  public String game;

  @Column(nullable = false)
  public int stars;

  @Column(nullable = false)
  public int mistakes;

  @Column(name = "word_count", nullable = false)
  public int wordCount;

  @Column(name = "study_date", nullable = false)
  public LocalDate studyDate;

  @Column(name = "finished_at", nullable = false)
  public Instant finishedAt;
}
