package com.vocabflow.tasks.domain;

/** What is possible for the user on a day; decides which variable tasks can be offered. */
public record TaskFacts(
    int dailyGoal,
    int ratedToday,
    int studyableWords,
    int dueReviews,
    int gameWords,
    boolean articleAvailable,
    boolean videoAvailable,
    boolean longArticleAvailable,
    boolean grammarVideoAvailable,
    boolean scenarioAvailable,
    boolean speakingAvailable) {
  /** Facts without a Canada scenario. */
  public TaskFacts(
      int dailyGoal,
      int ratedToday,
      int studyableWords,
      int dueReviews,
      int gameWords,
      boolean articleAvailable,
      boolean videoAvailable,
      boolean longArticleAvailable,
      boolean grammarVideoAvailable) {
    this(
        dailyGoal,
        ratedToday,
        studyableWords,
        dueReviews,
        gameWords,
        articleAvailable,
        videoAvailable,
        longArticleAvailable,
        grammarVideoAvailable,
        false,
        false);
  }

  /** Facts without a long article, a grammar video or a Canada scenario. */
  public TaskFacts(
      int dailyGoal,
      int ratedToday,
      int studyableWords,
      int dueReviews,
      int gameWords,
      boolean articleAvailable,
      boolean videoAvailable) {
    this(
        dailyGoal,
        ratedToday,
        studyableWords,
        dueReviews,
        gameWords,
        articleAvailable,
        videoAvailable,
        false,
        false,
        false,
        false);
  }
}
