package com.vocabflow.tasks.domain;

import java.util.List;

/** What the user did on one study day, as counted from the other modules' data. */
public record DayActivity(
    boolean planFinished,
    int ratedCards,
    int dueReviews,
    int wordsAdded,
    int wordsAddedFromArticles,
    int readings,
    int videosWatched,
    List<GameResult> rounds) {
  /** One finished practice round; {@code game} is the id the client sends. */
  public record GameResult(String game, int stars) {}
}
