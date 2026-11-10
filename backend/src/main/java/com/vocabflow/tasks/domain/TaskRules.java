package com.vocabflow.tasks.domain;

import java.util.ArrayList;
import java.util.List;

/** Which variable tasks are possible, with their targets, and how far a task has come. Pure. */
public final class TaskRules {
  /** The four practice games, by id. */
  public static final List<String> GAMES =
      List.of("quick-review", "fill-blank", "listen-choose", "spell-it");

  public static final int MIN_GAME_WORDS = 5;
  public static final int VARIABLE_TASKS = 4;
  public static final int ALL_DONE_BONUS = 5;

  private TaskRules() {}

  /** An article this long (reading minutes) or longer is a long one; the article list cuts here. */
  public static final int LONG_ARTICLE_MINUTES = 5;

  /** A task type that can be offered today, with one strength: its target and points. */
  public record Candidate(TaskType type, int target, int points, boolean hard) {}

  private static Candidate easy(TaskType type, int target, int points) {
    return new Candidate(type, target, points, false);
  }

  private static Candidate hard(TaskType type, int target, int points) {
    return new Candidate(type, target, points, true);
  }

  /**
   * Every task that can be offered today. A type may come in several strengths (a different target
   * and points); at most one hard one is picked a day, and none on a challenge day.
   */
  public static List<Candidate> candidates(TaskFacts facts) {
    List<Candidate> list = new ArrayList<>();
    int rateTarget = Math.max(5, Math.min(facts.dailyGoal(), 30));
    int rateable = facts.ratedToday() + facts.studyableWords();
    if (rateable >= rateTarget) {
      list.add(easy(TaskType.RATE_CARDS, rateTarget, 3));
      int more = rateTarget + rateTarget / 2;
      if (rateable >= more) {
        list.add(hard(TaskType.RATE_CARDS, more, 5));
      }
    }
    if (facts.dueReviews() > 0) {
      list.add(easy(TaskType.CLEAR_REVIEWS, facts.dueReviews(), 3));
    }
    int add = Math.max(2, Math.min(5, facts.dailyGoal() / 2));
    list.add(easy(TaskType.ADD_WORDS, add, 3));
    list.add(easy(TaskType.ADD_WORDS, add + 2, 4));
    list.add(hard(TaskType.ADD_WORDS, add + 4, 6));
    if (facts.articleAvailable()) {
      list.add(easy(TaskType.ADD_WORD_FROM_ARTICLE, 1, 4));
      list.add(hard(TaskType.ADD_WORD_FROM_ARTICLE, 3, 6));
      list.add(easy(TaskType.READ_ARTICLE, 1, 4));
      list.add(easy(TaskType.READ_ARTICLE, 2, 5));
      list.add(hard(TaskType.READ_ARTICLE, 3, 7));
    }
    if (facts.longArticleAvailable()) {
      list.add(easy(TaskType.READ_LONG_ARTICLE, 1, 5));
      list.add(easy(TaskType.CHALLENGE_READ, 2, 10));
    }
    if (facts.videoAvailable()) {
      list.add(easy(TaskType.WATCH_VIDEO, 1, 3));
      list.add(easy(TaskType.WATCH_VIDEO, 2, 5));
    }
    if (facts.grammarVideoAvailable()) {
      list.add(easy(TaskType.WATCH_GRAMMAR_VIDEO, 1, 4));
    }
    if (facts.gameWords() >= MIN_GAME_WORDS) {
      list.add(easy(TaskType.PLAY_ROUND, 1, 2));
      list.add(easy(TaskType.PLAY_ROUND, 2, 3));
      list.add(hard(TaskType.PLAY_ROUND, 3, 5));
      list.add(easy(TaskType.PLAY_GAME, 1, 3));
      list.add(easy(TaskType.PLAY_GAME, 2, 5));
      list.add(easy(TaskType.STARS_ROUND, 1, 5));
      list.add(hard(TaskType.SPELL_STARS, 1, 6));
      list.add(easy(TaskType.PERFECT_ROUND, 1, 5));
      list.add(hard(TaskType.DIFFERENT_GAMES, 3, 6));
      list.add(easy(TaskType.CHALLENGE_GAMES, 3, 9));
      list.add(easy(TaskType.CHALLENGE_PERFECT, 2, 8));
    }
    return list;
  }

  /** Whether the day is a challenge day: every 2 or 3 days, at a place that differs per user. */
  public static boolean challengeDay(long userId, java.time.LocalDate date) {
    long phase = Math.floorMod(date.toEpochDay() + userId, 5L);
    return phase == 0 || phase == 2;
  }

  /** How far the task has come, from 0 to its target. */
  public static int progress(DailyTask task, DayActivity day) {
    int count =
        switch (task.type()) {
          case STUDY_PLAN -> day.planFinished() ? 1 : 0;
          case RATE_CARDS -> day.ratedCards();
          case CLEAR_REVIEWS -> task.target() - day.dueReviews();
          case ADD_WORDS -> day.wordsAdded();
          case ADD_WORD_FROM_ARTICLE -> day.wordsAddedFromArticles();
          case READ_ARTICLE -> day.readings();
          case WATCH_VIDEO -> day.videosWatched();
          case PLAY_ROUND -> day.rounds().size();
          case PLAY_GAME ->
              (int) day.rounds().stream().filter(r -> r.game().equals(task.param())).count();
          case STARS_ROUND -> (int) day.rounds().stream().filter(r -> r.stars() >= 2).count();
          case READ_LONG_ARTICLE -> day.longReadings();
          case WATCH_GRAMMAR_VIDEO -> day.grammarVideos();
          case SPELL_STARS ->
              (int)
                  day.rounds().stream()
                      .filter(r -> r.game().equals("spell-it") && r.stars() >= 3)
                      .count();
          case PERFECT_ROUND -> perfectRounds(day);
          case DIFFERENT_GAMES -> (int) day.rounds().stream().map(r -> r.game()).distinct().count();
          case CHALLENGE_GAMES ->
              (int)
                  day.rounds().stream()
                      .filter(r -> r.stars() >= 2)
                      .map(r -> r.game())
                      .distinct()
                      .count();
          case CHALLENGE_PERFECT -> perfectRounds(day);
          case CHALLENGE_READ ->
              day.longReadings() >= 1 ? day.readings() : Math.min(1, day.readings());
        };
    return Math.max(0, Math.min(task.target(), count));
  }

  private static int perfectRounds(DayActivity day) {
    return (int) day.rounds().stream().filter(DayActivity.GameResult::perfect).count();
  }

  public static boolean done(DailyTask task, DayActivity day) {
    return progress(task, day) >= task.target();
  }
}
