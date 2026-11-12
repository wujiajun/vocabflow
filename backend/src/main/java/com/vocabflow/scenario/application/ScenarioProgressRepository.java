package com.vocabflow.scenario.application;

import java.time.Instant;
import java.util.Map;

public interface ScenarioProgressRepository {
  /** What a user has finished of one scenario. */
  record Progress(Instant completedAt, Integer bestScore) {}

  /** The user's finished scenarios by id. */
  Map<String, Progress> progress(long userId);

  /**
   * Marks the scenario finished (the first time only keeps its date) and keeps the best quiz score;
   * a null score changes no score.
   */
  void complete(long userId, String scenarioId, Instant at, Integer score);
}
