package com.vocabflow.tasks.infrastructure;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(
    name = "point_ledger",
    uniqueConstraints =
        @UniqueConstraint(
            name = "uk_point_ledger_user_date_key",
            columnNames = {"user_id", "study_date", "entry_key"}))
public class PointLedgerEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @Column(name = "user_id", nullable = false)
  public Long userId;

  @Column(name = "study_date", nullable = false)
  public LocalDate studyDate;

  @Column(name = "entry_key", nullable = false, length = 40)
  public String entryKey;

  @Column(nullable = false)
  public int amount;

  @Column(nullable = false, length = 120)
  public String reason;

  @Column(name = "created_at", nullable = false)
  public Instant createdAt;
}
