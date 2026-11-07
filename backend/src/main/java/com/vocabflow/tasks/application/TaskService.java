package com.vocabflow.tasks.application;

import com.vocabflow.identity.application.UserRepository;
import com.vocabflow.identity.domain.User;
import com.vocabflow.shared.web.BadRequestException;
import com.vocabflow.shared.web.UnauthorizedException;
import com.vocabflow.tasks.domain.*;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;

/**
 * The daily tasks. Deliberately not transactional: making a day's list and adding a ledger line
 * each catch a duplicate-key error, which must not happen inside a shared transaction.
 *
 * <p>Reading today's tasks makes the list when it is missing, counts what was done from the other
 * modules' data, and awards each finished task once (the ledger's unique key makes that safe to
 * repeat and to race). Only today is graded; another day is shown as stored.
 */
@Service
public class TaskService {
  static final String ALL_DONE = "ALL_DONE";

  private final UserRepository users;
  private final DailyTaskStore store;
  private final PointLedger ledger;
  private final LearningActivity learning;
  private final VocabularyActivity vocabulary;
  private final ArticleActivity articles;
  private final PassageActivity passages;
  private final VideoActivity videos;
  private final Clock clock;

  public TaskService(
      UserRepository users,
      DailyTaskStore store,
      PointLedger ledger,
      LearningActivity learning,
      VocabularyActivity vocabulary,
      ArticleActivity articles,
      PassageActivity passages,
      VideoActivity videos,
      Clock clock) {
    this.users = users;
    this.store = store;
    this.ledger = ledger;
    this.learning = learning;
    this.vocabulary = vocabulary;
    this.articles = articles;
    this.passages = passages;
    this.videos = videos;
    this.clock = clock;
  }

  public TaskDay day(long userId, LocalDate requestedDate) {
    User user =
        users
            .findById(userId)
            .orElseThrow(() -> new UnauthorizedException("User no longer exists"));
    ZoneId zone = user.timeZone() == null ? ZoneOffset.UTC : user.timeZone();
    LocalDate utcToday = LocalDate.now(clock.withZone(ZoneOffset.UTC));
    LocalDate date = requestedDate == null ? LocalDate.now(clock.withZone(zone)) : requestedDate;
    if (Math.abs(ChronoUnit.DAYS.between(utcToday, date)) > 1) {
      throw new BadRequestException("Date is out of range");
    }
    // With a zone the day is the server's call; without one the device's date is trusted.
    boolean today =
        user.timeZone() == null ? true : date.equals(LocalDate.now(clock.withZone(zone)));

    List<DailyTask> tasks = store.find(userId, date);
    if (tasks.isEmpty() && today) {
      create(user, zone, date);
      tasks = store.find(userId, date);
    }
    if (!today) {
      return view(userId, date, tasks, null);
    }
    DayActivity activity = activity(userId, zone, date);
    tasks = award(userId, date, tasks, activity);
    return view(userId, date, tasks, activity);
  }

  public PointLedger.Page ledger(long userId, int page, int size) {
    return ledger.page(userId, page, size);
  }

  private void create(User user, ZoneId zone, LocalDate date) {
    long userId = user.id();
    int goal = user.dailyVocabularyGoal().value();
    int clb = user.clbLevel().ordinal() + 1;
    DayActivity activity = activity(userId, zone, date);
    TaskFacts facts =
        new TaskFacts(
            goal,
            activity.ratedCards(),
            learning.newWordsAvailable(userId, goal),
            activity.dueReviews(),
            learning.gameWords(userId, date),
            articles.unreadArticleFor(userId, clb),
            videos.unwatchedVideoFor(userId, clb));
    List<DailyTask> list = new ArrayList<>();
    list.add(new DailyTask(TaskType.STUDY_PLAN, null, 1, TaskType.STUDY_PLAN.points(), null));
    list.addAll(
        TaskSelector.select(
            userId,
            date,
            TaskRules.candidates(facts),
            store.lastCompleted(userId, date),
            TaskRules.VARIABLE_TASKS));
    store.saveIfAbsent(userId, date, list);
  }

  private DayActivity activity(long userId, ZoneId zone, LocalDate date) {
    Instant from = date.atStartOfDay(zone).toInstant();
    Instant to = date.plusDays(1).atStartOfDay(zone).toInstant();
    return new DayActivity(
        learning.planFinished(userId, date),
        learning.ratedCards(userId, date),
        learning.dueReviews(userId, date),
        vocabulary.added(userId, from, to),
        vocabulary.addedFromArticles(userId, from, to),
        articles.readBetween(userId, from, to) + passages.readBetween(userId, from, to),
        videos.watchedBetween(userId, from, to),
        learning.rounds(userId, date));
  }

  /** Awards every finished task not yet awarded, then the day's bonuses; returns the new state. */
  private List<DailyTask> award(
      long userId, LocalDate date, List<DailyTask> tasks, DayActivity activity) {
    Instant now = clock.instant();
    List<DailyTask> updated = new ArrayList<>();
    for (DailyTask task : tasks) {
      if (!task.completed() && TaskRules.done(task, activity)) {
        // The ledger line first: if we stop in between, the next read finds it and just marks.
        ledger.addIfAbsent(
            new LedgerEntry(userId, date, task.key(), task.points(), reason(task), now));
        store.markCompleted(userId, date, task.key(), now);
        task = task.completedAt(now);
      }
      updated.add(task);
    }
    boolean baseDone =
        updated.stream().anyMatch(t -> t.type() == TaskType.STUDY_PLAN && t.completed());
    if (baseDone) {
      Set<LocalDate> days = store.baseCompletedDays(userId);
      int run = Streak.endingOn(days, date);
      if (Streak.BONUS_DAYS.contains(run)) {
        ledger.addIfAbsent(
            new LedgerEntry(
                userId,
                date,
                "STREAK_" + run,
                bonus(run),
                "Streak bonus: " + run + " days in a row",
                now));
      }
    }
    if (!updated.isEmpty() && updated.stream().allMatch(DailyTask::completed)) {
      ledger.addIfAbsent(
          new LedgerEntry(
              userId, date, ALL_DONE, TaskRules.ALL_DONE_BONUS, "All of today's tasks done", now));
    }
    return updated;
  }

  /** Streak bonuses grow with the run. */
  static int bonus(int days) {
    return switch (days) {
      case 3 -> 5;
      case 7 -> 10;
      case 14 -> 20;
      default -> 40;
    };
  }

  private static String reason(DailyTask task) {
    return switch (task.type()) {
      case STUDY_PLAN -> "Finished today's study plan";
      case RATE_CARDS -> "Rated " + task.target() + " cards";
      case CLEAR_REVIEWS -> "Cleared the due reviews";
      case ADD_WORDS -> "Added " + task.target() + " words";
      case ADD_WORD_FROM_ARTICLE -> "Added a word from an article";
      case READ_ARTICLE -> "Read an article";
      case WATCH_VIDEO -> "Watched a video";
      case PLAY_ROUND -> "Played a game round";
      case PLAY_GAME -> "Played " + task.param();
      case STARS_ROUND -> "Won 2 stars in a round";
    };
  }

  private TaskDay view(long userId, LocalDate date, List<DailyTask> tasks, DayActivity activity) {
    List<TaskDay.Item> items =
        tasks.stream()
            .map(
                t ->
                    new TaskDay.Item(
                        t,
                        t.completed()
                            ? t.target()
                            : activity == null ? 0 : TaskRules.progress(t, activity)))
            .toList();
    Set<LocalDate> days = store.baseCompletedDays(userId);
    return new TaskDay(
        date,
        items,
        !tasks.isEmpty() && tasks.stream().allMatch(DailyTask::completed),
        ledger.earnedOn(userId, date),
        ledger.balance(userId),
        Streak.current(days, date),
        Streak.best(days));
  }
}
