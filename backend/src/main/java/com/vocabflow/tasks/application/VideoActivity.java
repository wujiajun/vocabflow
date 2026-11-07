package com.vocabflow.tasks.application;

import java.time.Instant;

/** What the video module knows about the user's watching; implemented there. */
public interface VideoActivity {
  int watchedBetween(long userId, Instant from, Instant to);

  /** Is there a video the user has not watched, in an album for the CLB level (1 to 12)? */
  boolean unwatchedVideoFor(long userId, int clb);
}
