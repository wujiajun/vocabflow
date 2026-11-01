package com.vocabflow.reading.infrastructure;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(
    name = "reading_passages",
    uniqueConstraints =
        @UniqueConstraint(
            name = "uk_reading_passage_user_date",
            columnNames = {"user_id", "study_date"}))
public class ReadingPassageEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @Column(name = "user_id", nullable = false)
  public Long userId;

  @Column(name = "study_date", nullable = false)
  public LocalDate studyDate;

  @Column(nullable = false)
  public String title;

  @Column(nullable = false, columnDefinition = "TEXT")
  public String body;

  @Column(name = "words_json", nullable = false, columnDefinition = "TEXT")
  public String wordsJson;

  @Column(name = "read_at")
  public Instant readAt;

  @Column(name = "created_at", nullable = false)
  public Instant createdAt;

  @Column(nullable = false)
  public String source;
}
