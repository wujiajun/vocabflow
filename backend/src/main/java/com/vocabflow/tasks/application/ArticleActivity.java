package com.vocabflow.tasks.application;

import java.time.Instant;

/** What the article module knows about the user's reading; implemented there. */
public interface ArticleActivity {
  int readBetween(long userId, Instant from, Instant to);

  /** Of the articles read in the window, those of {@code minutes} reading minutes or more. */
  int readLongBetween(long userId, Instant from, Instant to, int minutes);

  /** Is there an unread article of {@code minutes} reading minutes or more for the CLB level? */
  boolean unreadLongArticleFor(long userId, int clb, int minutes);

  /** Is there an article the user has not read, in an album for the CLB level (1 to 12)? */
  boolean unreadArticleFor(long userId, int clb);
}
