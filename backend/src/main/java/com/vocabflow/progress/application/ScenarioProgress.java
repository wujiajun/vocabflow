package com.vocabflow.progress.application;

/** What the scenario module knows about the Life in Canada scenarios; implemented there. */
public interface ScenarioProgress {
  Scenes scenes(long userId);

  /**
   * Of the {@code total} scenarios offered: how many the user has finished, how many have a kept
   * speaking score, and the average of those scores (null when none).
   */
  record Scenes(int total, int finished, int spoken, Integer averageSpeaking) {}
}
