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
  STARS_ROUND(TaskCategory.GAMES, 5),
  /** An article of at least {@link TaskRules#LONG_ARTICLE_MINUTES} reading minutes. */
  READ_LONG_ARTICLE(TaskCategory.READING, 5),
  /** A video of a grammar album. */
  WATCH_GRAMMAR_VIDEO(TaskCategory.VIDEO, 4),
  /** A Spell it round with 3 stars. */
  SPELL_STARS(TaskCategory.GAMES, 6),
  /** A round with no wrong first try. */
  PERFECT_ROUND(TaskCategory.GAMES, 5),
  /** Rounds of different games. */
  DIFFERENT_GAMES(TaskCategory.GAMES, 6),
  /** Challenge: three different games, each with at least 2 stars. */
  CHALLENGE_GAMES(TaskCategory.GAMES, 9, true),
  /** Challenge: two rounds with no wrong first try. */
  CHALLENGE_PERFECT(TaskCategory.GAMES, 8, true),
  /** Challenge: read two articles, one of them long. */
  CHALLENGE_READ(TaskCategory.READING, 10, true),
  /** Finish a Life in Canada scenario not finished before (reading to its end, or its quiz). */
  READ_SCENARIO(TaskCategory.CANADA, 4),
  /** A Speak this scene round the phone heard and scored (self-rated rounds are not kept). */
  SPEAK_SCENARIO(TaskCategory.CANADA, 5);

  private final TaskCategory category;
  private final int points;
  private final boolean challenge;

  TaskType(TaskCategory category, int points) {
    this(category, points, false);
  }

  TaskType(TaskCategory category, int points, boolean challenge) {
    this.category = category;
    this.points = points;
    this.challenge = challenge;
  }

  /** The challenge of the day: harder than a normal task, shown with a mark. */
  public boolean challenge() {
    return challenge;
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
