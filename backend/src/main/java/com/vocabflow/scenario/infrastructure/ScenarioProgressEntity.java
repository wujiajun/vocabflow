package com.vocabflow.scenario.infrastructure;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(
    name = "scenario_progress",
    uniqueConstraints =
        @UniqueConstraint(
            name = "uk_scenario_progress_user_scenario",
            columnNames = {"user_id", "scenario_id"}))
public class ScenarioProgressEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @Column(name = "user_id", nullable = false)
  public Long userId;

  @Column(name = "scenario_id", nullable = false, length = 60)
  public String scenarioId;

  @Column(name = "completed_at", nullable = false)
  public Instant completedAt;

  @Column(name = "best_score")
  public Integer bestScore;
}
