package com.vocabflow.video.application;

import java.time.Instant;
import java.util.Map;
import java.util.Set;

public interface VideoProgressRepository {
  Set<String> watchedVideoIds(long userId);

  /** Does nothing when the video is already marked. */
  void markWatched(long userId, String videoId, Instant at);

  void unmarkWatched(long userId, String videoId);

  /**
   * Where each video the user has started stands, in seconds; a video without a place is absent.
   */
  Map<String, Integer> positions(long userId);

  /** Keeps the one place of the user's video: a new one replaces the old. */
  void savePosition(long userId, String videoId, int seconds, Instant at);

  void clearPosition(long userId, String videoId);
}
