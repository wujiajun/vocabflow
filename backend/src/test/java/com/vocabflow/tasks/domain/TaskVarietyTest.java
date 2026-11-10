package com.vocabflow.tasks.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.vocabflow.tasks.domain.DayActivity.GameResult;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import org.junit.jupiter.api.Test;

/** Variety of the daily lists, the strengths and the challenge, and the new kinds' progress. */
class TaskVarietyTest {
  private static final LocalDate START = LocalDate.of(2026, 11, 1);
  private static final TaskFacts FULL = new TaskFacts(20, 0, 40, 6, 12, true, true, true, true);

  private static DayActivity day(int longReads, int reads, int grammar, GameResult... rounds) {
    return new DayActivity(false, 0, 0, 0, 0, reads, 0, List.of(rounds), longReads, grammar);
  }

  private static DailyTask task(TaskType type, int target) {
    return new DailyTask(type, null, target, type.points(), null);
  }

  private static GameResult round(String game, int stars, int mistakes) {
    return new GameResult(game, stars, mistakes, 10);
  }

  private static List<DailyTask> pick(
      long user, LocalDate date, Map<TaskCategory, LocalDate> last) {
    return TaskSelector.select(
        user, date, TaskRules.candidates(FULL), last, TaskRules.VARIABLE_TASKS);
  }

  @Test
  void thirtyDaysOfOneUserShowManyDifferentLists() {
    for (long user : new long[] {7, 8, 9}) {
      Set<List<String>> lists = new HashSet<>();
      Set<String> kinds = new HashSet<>();
      int shared = 0;
      int maxDay = 0;
      int challenges = 0;
      List<String> prev = List.of();
      Map<TaskCategory, LocalDate> last = new EnumMap<>(TaskCategory.class);
      for (int d = 0; d < 30; d++) {
        LocalDate date = START.plusDays(d);
        List<DailyTask> tasks = pick(user, date, last);
        List<String> keys = tasks.stream().map(t -> t.key() + "x" + t.target()).sorted().toList();
        lists.add(keys);
        kinds.addAll(keys);
        keys.stream().filter(prev::contains).forEach(k -> {});
        shared += (int) keys.stream().filter(prev::contains).count();
        prev = keys;
        maxDay = Math.max(maxDay, 10 + tasks.stream().mapToInt(DailyTask::points).sum() + 5);
        challenges += tasks.stream().anyMatch(t -> t.type().challenge()) ? 1 : 0;
        tasks.forEach(t -> last.put(t.type().category(), date));
        last.put(TaskCategory.STUDY, date);
      }
      System.out.println(
          "SIM user="
              + user
              + " distinctLists="
              + lists.size()
              + " distinctTaskKinds="
              + kinds.size()
              + " sharedWithPrevDayPerDay="
              + shared / 29.0
              + " challengeDays="
              + challenges
              + " maxDayPoints="
              + maxDay);
      assertThat(lists.size()).as("lists of user " + user).isGreaterThanOrEqualTo(28);
      assertThat(kinds.size()).isGreaterThanOrEqualTo(22);
      assertThat(shared / 29.0).isLessThan(1.8);
      assertThat(maxDay).isLessThanOrEqualTo(40);
    }
  }

  @Test
  void challengeComesEveryTwoOrThreeDaysAndIsOneOfTheFourTasks() {
    for (long user = 1; user <= 12; user++) {
      List<LocalDate> days = new ArrayList<>();
      for (int d = 0; d < 60; d++) {
        LocalDate date = START.plusDays(d);
        List<DailyTask> tasks = pick(user, date, Map.of());
        assertThat(tasks).hasSize(TaskRules.VARIABLE_TASKS);
        long challenges = tasks.stream().filter(t -> t.type().challenge()).count();
        assertThat(challenges).isEqualTo(TaskRules.challengeDay(user, date) ? 1 : 0);
        if (challenges == 1) {
          days.add(date);
          DailyTask c = tasks.stream().filter(t -> t.type().challenge()).findFirst().orElseThrow();
          assertThat(c.points()).isBetween(8, 10);
          // The challenge is the day's hard task: nothing else is hard, and no category repeats.
          assertThat(tasks.stream().map(t -> t.type().category()).distinct()).hasSize(4);
          assertThat(tasks).filteredOn(t -> !t.type().challenge()).allMatch(t -> t.points() <= 5);
        }
      }
      for (int i = 1; i < days.size(); i++) {
        long gap = days.get(i).toEpochDay() - days.get(i - 1).toEpochDay();
        assertThat(gap).isBetween(2L, 3L);
      }
      assertThat(days.size()).isBetween(22, 26);
    }
  }

  @Test
  void atMostOneHardTaskADayAndPointsStayInRange() {
    TreeSet<Integer> maxima = new TreeSet<>();
    for (long user = 1; user <= 40; user++) {
      for (int d = 0; d < 40; d++) {
        LocalDate date = START.plusDays(d);
        List<DailyTask> tasks = pick(user, date, Map.of());
        long hard =
            TaskRules.candidates(FULL).stream()
                .filter(TaskRules.Candidate::hard)
                .filter(
                    c ->
                        tasks.stream()
                            .anyMatch(
                                t ->
                                    t.type() == c.type()
                                        && t.target() == c.target()
                                        && t.points() == c.points()))
                .count();
        assertThat(hard).isLessThanOrEqualTo(1);
        int total = 10 + tasks.stream().mapToInt(DailyTask::points).sum() + 5;
        assertThat(total).isBetween(18, 40);
        maxima.add(total);
      }
    }
    assertThat(maxima.last()).isLessThanOrEqualTo(40);
  }

  @Test
  void theSameTypeComesInDifferentStrengthsWithMorePointsForMore() {
    Set<Integer> readTargets = new TreeSet<>();
    for (TaskRules.Candidate c : TaskRules.candidates(FULL)) {
      if (c.type() == TaskType.READ_ARTICLE) {
        readTargets.add(c.target());
      }
    }
    assertThat(readTargets).containsExactly(1, 2, 3);
    for (TaskType type : TaskType.values()) {
      List<TaskRules.Candidate> same =
          TaskRules.candidates(FULL).stream().filter(c -> c.type() == type).toList();
      for (TaskRules.Candidate a : same) {
        for (TaskRules.Candidate b : same) {
          if (a.target() < b.target()) {
            assertThat(a.points()).as(type + " " + a.target()).isLessThan(b.points());
          }
        }
      }
    }
  }

  @Test
  void newKindsAreOnlyOfferedWhenTheDataAllowsThem() {
    TaskFacts none = new TaskFacts(20, 0, 40, 6, 12, true, true, false, false);
    Set<TaskType> types = new HashSet<>();
    TaskRules.candidates(none).forEach(c -> types.add(c.type()));
    assertThat(types)
        .doesNotContain(
            TaskType.READ_LONG_ARTICLE, TaskType.WATCH_GRAMMAR_VIDEO, TaskType.CHALLENGE_READ);
    TaskFacts noGames = new TaskFacts(20, 0, 40, 6, 4, true, true, true, true);
    types.clear();
    TaskRules.candidates(noGames).forEach(c -> types.add(c.type()));
    assertThat(types)
        .doesNotContain(
            TaskType.SPELL_STARS,
            TaskType.PERFECT_ROUND,
            TaskType.DIFFERENT_GAMES,
            TaskType.CHALLENGE_GAMES,
            TaskType.CHALLENGE_PERFECT);
  }

  @Test
  void newKindsCountTheirOwnData() {
    GameResult spell3 = round("spell-it", 3, 0);
    GameResult fill2 = round("fill-blank", 2, 2);
    GameResult listen2 = round("listen-choose", 2, 1);
    GameResult spell2 = round("spell-it", 2, 1);
    DayActivity d = day(1, 2, 1, spell3, fill2, listen2);

    assertThat(TaskRules.done(task(TaskType.READ_LONG_ARTICLE, 1), d)).isTrue();
    assertThat(TaskRules.done(task(TaskType.READ_LONG_ARTICLE, 1), day(0, 3, 0))).isFalse();
    assertThat(TaskRules.done(task(TaskType.WATCH_GRAMMAR_VIDEO, 1), d)).isTrue();
    assertThat(TaskRules.done(task(TaskType.WATCH_GRAMMAR_VIDEO, 1), day(0, 0, 0))).isFalse();

    assertThat(TaskRules.done(task(TaskType.SPELL_STARS, 1), d)).isTrue();
    assertThat(TaskRules.done(task(TaskType.SPELL_STARS, 1), day(0, 0, 0, spell2))).isFalse();
    assertThat(
            TaskRules.done(task(TaskType.SPELL_STARS, 1), day(0, 0, 0, round("fill-blank", 3, 0))))
        .as("3 stars in another game")
        .isFalse();

    assertThat(TaskRules.done(task(TaskType.PERFECT_ROUND, 1), d)).isTrue();
    assertThat(TaskRules.done(task(TaskType.PERFECT_ROUND, 1), day(0, 0, 0, fill2, listen2)))
        .isFalse();
    assertThat(
            TaskRules.done(
                task(TaskType.PERFECT_ROUND, 1), day(0, 0, 0, new GameResult("spell-it", 3, 0, 2))))
        .as("a round of two words does not count")
        .isFalse();

    assertThat(TaskRules.progress(task(TaskType.DIFFERENT_GAMES, 3), d)).isEqualTo(3);
    assertThat(
            TaskRules.progress(
                task(TaskType.DIFFERENT_GAMES, 3), day(0, 0, 0, spell3, spell2, spell3)))
        .as("the same game again is one game")
        .isEqualTo(1);

    assertThat(TaskRules.done(task(TaskType.CHALLENGE_GAMES, 3), d)).isTrue();
    assertThat(
            TaskRules.progress(
                task(TaskType.CHALLENGE_GAMES, 3),
                day(0, 0, 0, spell3, round("fill-blank", 1, 3), listen2)))
        .as("a game with one star does not count")
        .isEqualTo(2);

    assertThat(TaskRules.done(task(TaskType.CHALLENGE_PERFECT, 2), d)).isFalse();
    assertThat(
            TaskRules.done(
                task(TaskType.CHALLENGE_PERFECT, 2),
                day(0, 0, 0, spell3, round("fill-blank", 3, 0))))
        .isTrue();

    assertThat(TaskRules.done(task(TaskType.CHALLENGE_READ, 2), d)).isTrue();
    assertThat(TaskRules.done(task(TaskType.CHALLENGE_READ, 2), day(0, 2, 0)))
        .as("two short articles are not enough")
        .isFalse();
    assertThat(TaskRules.done(task(TaskType.CHALLENGE_READ, 2), day(1, 1, 0)))
        .as("one long article alone is not enough")
        .isFalse();
  }

  @Test
  void aStoredOldTaskStillReadsAsItWas() {
    // Old rows keep their type name, target and points; the types are only ever added to.
    for (String old :
        List.of(
            "STUDY_PLAN",
            "RATE_CARDS",
            "CLEAR_REVIEWS",
            "ADD_WORDS",
            "ADD_WORD_FROM_ARTICLE",
            "READ_ARTICLE",
            "WATCH_VIDEO",
            "PLAY_ROUND",
            "PLAY_GAME",
            "STARS_ROUND")) {
      assertThat(TaskType.valueOf(old).name()).isEqualTo(old);
    }
    assertThat(TaskType.values()[TaskType.values().length - 1].name()).startsWith("CHALLENGE");
    assertThat(TaskType.PLAY_GAME.points()).isEqualTo(3);
    assertThat(TaskType.STARS_ROUND.points()).isEqualTo(5);
  }
}
