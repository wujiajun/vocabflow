package com.vocabflow.vocabulary.infrastructure;

import com.vocabflow.tasks.application.VocabularyActivity;
import java.time.Instant;
import org.springframework.stereotype.Component;

/** Counts the words a user added in a time window, for the daily tasks. */
@Component
public class VocabularyTaskActivity implements VocabularyActivity {
  /** Words tapped in an article carry a link to it (see {@code SourceContext}). */
  static final String ARTICLE_LINK = "/app/reading/articles/a/";

  private final UserVocabularyJpaRepository words;

  public VocabularyTaskActivity(UserVocabularyJpaRepository words) {
    this.words = words;
  }

  @Override
  public int added(long userId, Instant from, Instant to) {
    return words.countByUserIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(userId, from, to);
  }

  @Override
  public int addedFromArticles(long userId, Instant from, Instant to) {
    return words
        .countByUserIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanAndSourceLinkStartingWith(
            userId, from, to, ARTICLE_LINK);
  }
}
