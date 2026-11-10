package com.vocabflow.tasks.application;

import java.time.Instant;

/** What the video module knows about the user's watching; implemented there. */
public interface VideoActivity {
  int watchedBetween(long userId, Instant from, Instant to);

  /** Of the videos watched in the window, those in a grammar album. */
  int grammarWatchedBetween(long userId, Instant from, Instant to);

  /** Is there an unwatched grammar video in an album for the CLB level? */
  boolean unwatchedGrammarVideoFor(long userId, int clb);

  /** Is there a video the user has not watched, in an album for the CLB level (1 to 12)? */
  boolean unwatchedVideoFor(long userId, int clb);
}
