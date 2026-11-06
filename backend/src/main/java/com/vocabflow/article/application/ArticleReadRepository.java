package com.vocabflow.article.application;

import java.time.Instant;
import java.util.Map;

public interface ArticleReadRepository {
  /** The articles the user has read, with when. */
  Map<String, Instant> reads(long userId);

  /** Does nothing when the article is already marked. */
  void markRead(long userId, String articleId, Instant at);

  void unmarkRead(long userId, String articleId);
}
