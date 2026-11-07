package com.vocabflow.learning.application;

import java.time.Instant;
import java.util.Collection;
import java.util.Map;

/** Which words the practice games used and when, per user, shared by all four games. */
public interface GameWordPlays {
  /** When each of the words was last played; words never played are absent. */
  Map<Long, Instant> lastPlayed(long userId, Collection<Long> userVocabularyIds);

  /**
   * Notes that the words were played at {@code now}: adds one to each count, or starts it. Catches
   * a duplicate-key error, so it must not run inside a shared transaction.
   */
  void record(long userId, Collection<Long> userVocabularyIds, Instant now);
}
