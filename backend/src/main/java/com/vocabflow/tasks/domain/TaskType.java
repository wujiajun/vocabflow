package com.vocabflow.tasks.domain;

/** The kinds of task a day can hold, with the points each earns (named constants, hard-coded). */
public enum TaskType {
  /** The fixed task of every day: finish the day's study plan. */
  STUDY_PLAN(TaskCategory.STUDY, 10),
  RATE_CARDS(TaskCategory.STUDY, 3),
  CLEAR_REVIEWS(TaskCategory.STUDY, 3),
  ADD_WORDS(TaskCategory.ADD_WORDS, 3),
  ADD_WORD_FROM_ARTICLE(TaskCategory.ADD_WORDS, 4),
  READ_ARTICLE(TaskCategory.READING, 4),
  WATCH_VIDEO(TaskCategory.VIDEO, 3),
  PLAY_ROUND(TaskCategory.GAMES, 2),
  PLAY_GAME(TaskCategory.GAMES, 3),
  STARS_ROUND(TaskCategory.GAMES, 5);

  private final TaskCategory category;
  private final int points;

  TaskType(TaskCategory category, int points) {
    this.category = category;
    this.points = points;
  }

  public TaskCategory category() {
    return category;
  }

  public int points() {
    return points;
  }

  /** Whether the task names one of the four practice games. */
  public boolean needsGame() {
    return this == PLAY_GAME;
  }
}
