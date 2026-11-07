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

  /** A task type that can be offered today, with its target. */
  public record Candidate(TaskType type, int target) {}

  public static List<Candidate> candidates(TaskFacts facts) {
    List<Candidate> list = new ArrayList<>();
    int rateTarget = Math.max(5, Math.min(facts.dailyGoal(), 30));
    if (facts.ratedToday() + facts.studyableWords() >= rateTarget) {
      list.add(new Candidate(TaskType.RATE_CARDS, rateTarget));
    }
    if (facts.dueReviews() > 0) {
      list.add(new Candidate(TaskType.CLEAR_REVIEWS, facts.dueReviews()));
    }
    list.add(new Candidate(TaskType.ADD_WORDS, Math.max(2, Math.min(5, facts.dailyGoal() / 2))));
    if (facts.articleAvailable()) {
      list.add(new Candidate(TaskType.ADD_WORD_FROM_ARTICLE, 1));
      list.add(new Candidate(TaskType.READ_ARTICLE, 1));
    }
    if (facts.videoAvailable()) {
      list.add(new Candidate(TaskType.WATCH_VIDEO, 1));
    }
    if (facts.gameWords() >= MIN_GAME_WORDS) {
      list.add(new Candidate(TaskType.PLAY_ROUND, 1));
      list.add(new Candidate(TaskType.PLAY_GAME, 1));
      list.add(new Candidate(TaskType.STARS_ROUND, 1));
    }
    return list;
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
        };
    return Math.max(0, Math.min(task.target(), count));
  }

  public static boolean done(DailyTask task, DayActivity day) {
    return progress(task, day) >= task.target();
  }
}
