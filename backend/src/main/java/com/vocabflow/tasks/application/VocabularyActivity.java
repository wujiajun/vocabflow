package com.vocabflow.tasks.application;

import java.time.Instant;

/** What the vocabulary module knows about words added in a time window; implemented there. */
public interface VocabularyActivity {
  /** Words the user added from {@code from} (included) to {@code to} (excluded). */
  int added(long userId, Instant from, Instant to);

  /** Of those, the words added by tapping them in an article. */
  int addedFromArticles(long userId, Instant from, Instant to);
}
