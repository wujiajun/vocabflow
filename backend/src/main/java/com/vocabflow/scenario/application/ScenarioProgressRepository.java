package com.vocabflow.scenario.application;

import java.time.Instant;
import java.util.Map;

public interface ScenarioProgressRepository {
  /**
   * What a user has done with one scenario: finished at, best quiz score, and the latest Speak this
   * scene score (0-100) with its time.
   */
  record Progress(Instant completedAt, Integer bestScore, Integer speakingScore, Instant spokenAt) {
    public Progress(Instant completedAt, Integer bestScore) {
      this(completedAt, bestScore, null, null);
    }
  }

  /** The user's finished scenarios by id. */
  Map<String, Progress> progress(long userId);

  /**
   * Marks the scenario finished (the first time only keeps its date) and keeps the best quiz score;
   * a null score changes no score.
   */
  void complete(long userId, String scenarioId, Instant at, Integer score);

  /**
   * Keeps the latest speaking score (0-100) and its time, replacing the one before; the scenario
   * also counts as finished from then on.
   */
  void recordSpeaking(long userId, String scenarioId, Instant at, int score);
}
