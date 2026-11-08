package com.vocabflow.progress.application;

import com.vocabflow.identity.application.UserRepository;
import com.vocabflow.identity.domain.User;
import com.vocabflow.progress.domain.Milestones;
import com.vocabflow.shared.web.BadRequestException;
import com.vocabflow.shared.web.UnauthorizedException;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** Read-only progress summary, aggregated by the learner's study day. */
@Service
public class ProgressService {
  /** Twelve weeks of days shown in the calendar. */
  public static final int CALENDAR_DAYS = 84;

  private static final int WEEK = 7;

  private final UserRepository users;
  private final LearningProgress learning;
  private final TaskProgress tasks;
  private final Clock clock;

  public ProgressService(
      UserRepository users, LearningProgress learning, TaskProgress tasks, Clock clock) {
    this.users = users;
    this.learning = learning;
    this.tasks = tasks;
    this.clock = clock;
  }

  /**
   * @param deviceZone the device's IANA zone; used for "today" only when the user has not stored a
   *     zone and sent no date
   */
  public ProgressSummary summary(long userId, LocalDate requestedDate, String deviceZone) {
    User user =
        users
            .findById(userId)
            .orElseThrow(() -> new UnauthorizedException("User no longer exists"));
    ZoneId zone = user.timeZone() != null ? user.timeZone() : device(deviceZone);
    LocalDate utcToday = LocalDate.now(clock.withZone(ZoneOffset.UTC));
    LocalDate date = requestedDate == null ? LocalDate.now(clock.withZone(zone)) : requestedDate;
    if (Math.abs(ChronoUnit.DAYS.between(utcToday, date)) > 1) {
      throw new BadRequestException("Date is out of range");
    }
    LocalDate from = date.minusDays(CALENDAR_DAYS - 1);

    int started = learning.startedWords(userId);
    int mastered = Math.min(learning.masteredWords(userId), started);

    Map<LocalDate, LearningProgress.DayCards> cards = new HashMap<>();
    learning.cardsByDay(userId, from, date).forEach(c -> cards.put(c.date(), c));
    Map<LocalDate, Integer> rounds = learning.roundsByDay(userId, from, date);
    Map<LocalDate, Integer> points = tasks.pointsByDay(userId, from, date);

    List<ProgressSummary.Day> days = new ArrayList<>();
    for (LocalDate d = from; !d.isAfter(date); d = d.plusDays(1)) {
      LearningProgress.DayCards c = cards.get(d);
      int total = c == null ? 0 : c.cards();
      int fresh = c == null ? 0 : Math.min(c.newWords(), total);
      days.add(
          new ProgressSummary.Day(
              d,
              total,
              total - fresh,
              fresh,
              rounds.getOrDefault(d, 0),
              points.getOrDefault(d, 0)));
    }
    TaskProgress.Streaks streaks = tasks.streaks(userId, date);
    var next = Milestones.next(mastered);
    return new ProgressSummary(
        date,
        started,
        mastered,
        started - mastered,
        streaks.current(),
        streaks.best(),
        new ProgressSummary.Milestone(
            Milestones.previous(mastered), next.isPresent() ? next.getAsInt() : null),
        days,
        week(days, days.size() - WEEK, days.size()),
        week(days, days.size() - 2 * WEEK, days.size() - WEEK));
  }

  private static ProgressSummary.Week week(List<ProgressSummary.Day> days, int from, int to) {
    int reviews = 0;
    int newWords = 0;
    int rounds = 0;
    for (ProgressSummary.Day d : days.subList(from, to)) {
      reviews += d.reviews();
      newWords += d.newWords();
      rounds += d.rounds();
    }
    return new ProgressSummary.Week(reviews, newWords, rounds);
  }

  private static ZoneId device(String id) {
    if (id == null || id.isBlank()) {
      return ZoneOffset.UTC;
    }
    try {
      return ZoneId.of(id);
    } catch (java.time.DateTimeException invalid) {
      throw new BadRequestException("Unknown time zone");
    }
  }
}
