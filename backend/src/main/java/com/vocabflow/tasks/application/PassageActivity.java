package com.vocabflow.tasks.application;

import java.time.Instant;

/** What the reading module knows about the user's own daily passages; implemented there. */
public interface PassageActivity {
  int readBetween(long userId, Instant from, Instant to);
}
