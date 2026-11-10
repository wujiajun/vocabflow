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
    List<GameResult> rounds,
    int longReadings,
    int grammarVideos) {
  /** Activity without long articles or grammar videos. */
  public DayActivity(
      boolean planFinished,
      int ratedCards,
      int dueReviews,
      int wordsAdded,
      int wordsAddedFromArticles,
      int readings,
      int videosWatched,
      List<GameResult> rounds) {
    this(
        planFinished,
        ratedCards,
        dueReviews,
        wordsAdded,
        wordsAddedFromArticles,
        readings,
        videosWatched,
        rounds,
        0,
        0);
  }

  /** One finished practice round; {@code game} is the id the client sends. */
  public record GameResult(String game, int stars, int mistakes, int wordCount) {
    /** A round that was not perfect (one mistake) of a usual size. */
    public GameResult(String game, int stars) {
      this(game, stars, 1, 10);
    }

    /** No wrong first try, in a round of a real size. */
    public boolean perfect() {
      return mistakes == 0 && wordCount >= TaskRules.MIN_GAME_WORDS;
    }
  }
}
