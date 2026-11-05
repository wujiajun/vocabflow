package com.vocabflow.video.application;

import java.time.Instant;
import java.util.Set;

public interface VideoProgressRepository {
  Set<String> watchedVideoIds(long userId);

  /** Does nothing when the video is already marked. */
  void markWatched(long userId, String videoId, Instant at);

  void unmarkWatched(long userId, String videoId);
}
