package com.vocabflow.learning.infrastructure;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "review_logs")
public class ReviewLogEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @Column(name = "user_id", nullable = false)
  public Long userId;

  @Column(name = "user_vocabulary_id", nullable = false)
  public Long userVocabularyId;

  @Column(nullable = false)
  public String rating;

  @Column(name = "state_before", nullable = false)
  public String stateBefore;

  @Column(name = "interval_before", nullable = false)
  public int intervalBefore;

  @Column(name = "ease_before", nullable = false)
  public int easeBefore;

  @Column(name = "state_after", nullable = false)
  public String stateAfter;

  @Column(name = "interval_after", nullable = false)
  public int intervalAfter;

  @Column(name = "ease_after", nullable = false)
  public int easeAfter;

  @Column(name = "review_date", nullable = false)
  public LocalDate reviewDate;

  @Column(name = "reviewed_at", nullable = false)
  public Instant reviewedAt;
}
