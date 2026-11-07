package com.vocabflow.tasks.application;

import java.time.Instant;

/** What the article module knows about the user's reading; implemented there. */
public interface ArticleActivity {
  int readBetween(long userId, Instant from, Instant to);

  /** Is there an article the user has not read, in an album for the CLB level (1 to 12)? */
  boolean unreadArticleFor(long userId, int clb);
}
