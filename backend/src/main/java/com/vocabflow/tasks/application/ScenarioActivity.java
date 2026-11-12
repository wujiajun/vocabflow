package com.vocabflow.tasks.application;

import java.time.Instant;

/** What the scenario module knows about the user's Life in Canada scenarios; implemented there. */
public interface ScenarioActivity {
  /** Scenarios first finished in the window (reading to the end, the quiz, or speaking). */
  int finishedBetween(long userId, Instant from, Instant to);

  /** Scenarios whose latest scored Speak this scene round falls in the window. */
  int spokenBetween(long userId, Instant from, Instant to);

  /** Is there a scenario the user has not finished? */
  boolean unfinishedScenario(long userId);

  /** Is there a scenario with a conversation to speak? */
  boolean speakableScenario();
}
