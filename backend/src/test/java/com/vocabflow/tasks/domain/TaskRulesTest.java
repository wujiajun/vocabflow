package com.vocabflow.tasks.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class TaskRulesTest {
  private static final LocalDate DAY = LocalDate.of(2026, 11, 8);
  private static final TaskFacts EVERYTHING = new TaskFacts(20, 0, 40, 6, 12, true, true);

  private static Set<TaskType> types(TaskFacts facts) {
    return TaskRules.candidates(facts).stream()
        .map(TaskRules.Candidate::type)
        .collect(java.util.stream.Collectors.toSet());
  }

  @Test
  void everyKindIsPossibleWhenTheDataAllowsIt() {
    assertThat(types(EVERYTHING))
        .containsExactlyInAnyOrder(
            TaskType.RATE_CARDS,
            TaskType.CLEAR_REVIEWS,
            TaskType.ADD_WORDS,
            TaskType.ADD_WORD_FROM_ARTICLE,
            TaskType.READ_ARTICLE,
            TaskType.WATCH_VIDEO,
            TaskType.PLAY_ROUND,
            TaskType.PLAY_GAME,
            TaskType.STARS_ROUND,
            TaskType.SPELL_STARS,
            TaskType.PERFECT_ROUND,
            TaskType.DIFFERENT_GAMES,
            TaskType.CHALLENGE_GAMES,
            TaskType.CHALLENGE_PERFECT);
  }

  @Test
  void aKindIsLeftOutWhenItCannotBeDoneToday() {
    assertThat(types(new TaskFacts(20, 0, 40, 0, 12, true, true)))
        .doesNotContain(TaskType.CLEAR_REVIEWS);
    assertThat(types(new TaskFacts(20, 0, 40, 6, 12, false, true)))
        .doesNotContain(TaskType.READ_ARTICLE, TaskType.ADD_WORD_FROM_ARTICLE);
    assertThat(types(new TaskFacts(20, 0, 40, 6, 12, true, false)))
        .doesNotContain(TaskType.WATCH_VIDEO);
    assertThat(types(new TaskFacts(20, 0, 40, 6, 4, true, true)))
        .doesNotContain(TaskType.PLAY_ROUND, TaskType.PLAY_GAME, TaskType.STARS_ROUND);
    assertThat(types(new TaskFacts(20, 0, 40, 6, 5, true, true))).contains(TaskType.PLAY_ROUND);
    assertThat(types(new TaskFacts(20, 3, 10, 6, 12, true, true)))
        .as("3 rated + 10 left is below 20")
        .doesNotContain(TaskType.RATE_CARDS);
    assertThat(types(new TaskFacts(20, 15, 5, 6, 12, true, true))).contains(TaskType.RATE_CARDS);
  }

  @Test
  void targetsFollowTheDailyGoalWithinLimits() {
    assertThat(target(new TaskFacts(20, 0, 99, 0, 0, false, false), TaskType.RATE_CARDS))
        .isEqualTo(20);
    assertThat(target(new TaskFacts(3, 0, 99, 0, 0, false, false), TaskType.RATE_CARDS))
        .isEqualTo(5);
    assertThat(target(new TaskFacts(100, 0, 99, 0, 0, false, false), TaskType.RATE_CARDS))
        .isEqualTo(30);
    assertThat(target(new TaskFacts(1, 0, 0, 0, 0, false, false), TaskType.ADD_WORDS)).isEqualTo(2);
    assertThat(target(new TaskFacts(100, 0, 0, 0, 0, false, false), TaskType.ADD_WORDS))
        .isEqualTo(5);
    assertThat(target(new TaskFacts(20, 0, 0, 7, 0, false, false), TaskType.CLEAR_REVIEWS))
        .isEqualTo(7);
  }

  private static int target(TaskFacts facts, TaskType type) {
    return TaskRules.candidates(facts).stream()
        .filter(c -> c.type() == type)
        .findFirst()
        .orElseThrow()
        .target();
  }

  private static DayActivity day(
      boolean finished,
      int rated,
      int due,
      int added,
      int fromArticle,
      int reads,
      int videos,
      DayActivity.GameResult... rounds) {
    return new DayActivity(
        finished, rated, due, added, fromArticle, reads, videos, List.of(rounds));
  }

  private static DailyTask task(TaskType type, String param, int target) {
    return new DailyTask(type, param, target, type.points(), null);
  }

  @Test
  void eachKindCountsItsOwnData() {
    DayActivity.GameResult spell = new DayActivity.GameResult("spell-it", 1);
    DayActivity.GameResult great = new DayActivity.GameResult("fill-blank", 3);
    DayActivity day = day(true, 7, 2, 3, 1, 1, 1, spell, great);

    assertThat(TaskRules.progress(task(TaskType.STUDY_PLAN, null, 1), day)).isEqualTo(1);
    assertThat(TaskRules.progress(task(TaskType.STUDY_PLAN, null, 1), day(false, 0, 0, 0, 0, 0, 0)))
        .isZero();
    assertThat(TaskRules.progress(task(TaskType.RATE_CARDS, null, 10), day)).isEqualTo(7);
    assertThat(TaskRules.progress(task(TaskType.RATE_CARDS, null, 5), day)).isEqualTo(5);
    assertThat(TaskRules.progress(task(TaskType.CLEAR_REVIEWS, null, 6), day)).isEqualTo(4);
    assertThat(TaskRules.done(task(TaskType.CLEAR_REVIEWS, null, 6), day)).isFalse();
    assertThat(TaskRules.done(task(TaskType.CLEAR_REVIEWS, null, 6), day(true, 0, 0, 0, 0, 0, 0)))
        .isTrue();
    assertThat(TaskRules.progress(task(TaskType.ADD_WORDS, null, 5), day)).isEqualTo(3);
    assertThat(TaskRules.done(task(TaskType.ADD_WORD_FROM_ARTICLE, null, 1), day)).isTrue();
    assertThat(TaskRules.done(task(TaskType.READ_ARTICLE, null, 1), day)).isTrue();
    assertThat(TaskRules.done(task(TaskType.WATCH_VIDEO, null, 1), day)).isTrue();
    assertThat(TaskRules.done(task(TaskType.PLAY_ROUND, null, 1), day)).isTrue();
    assertThat(TaskRules.done(task(TaskType.PLAY_GAME, "spell-it", 1), day)).isTrue();
    assertThat(TaskRules.done(task(TaskType.PLAY_GAME, "quick-review", 1), day)).isFalse();
    assertThat(TaskRules.done(task(TaskType.STARS_ROUND, null, 1), day)).isTrue();
    assertThat(
            TaskRules.done(task(TaskType.STARS_ROUND, null, 1), day(true, 0, 0, 0, 0, 0, 0, spell)))
        .as("one star is not enough")
        .isFalse();
  }

  @Test
  void anIdleDayHasNoProgress() {
    DayActivity idle = day(false, 0, 6, 0, 0, 0, 0);
    for (TaskType type : TaskType.values()) {
      DailyTask task = task(type, type.needsGame() ? "spell-it" : null, 3);
      assertThat(TaskRules.done(task, idle)).as(type.name()).isFalse();
    }
  }

  @Test
  void aNamedGameTaskNeedsAGameAndOthersMayNotHaveOne() {
    org.assertj.core.api.Assertions.assertThatThrownBy(() -> task(TaskType.PLAY_GAME, null, 1))
        .isInstanceOf(IllegalArgumentException.class);
    org.assertj.core.api.Assertions.assertThatThrownBy(() -> task(TaskType.PLAY_ROUND, "x", 1))
        .isInstanceOf(IllegalArgumentException.class);
    assertThat(task(TaskType.PLAY_GAME, "spell-it", 1).key()).isEqualTo("PLAY_GAME:spell-it");
  }

  // ---- selector ----

  private static List<DailyTask> pick(
      long user, LocalDate date, Map<TaskCategory, LocalDate> last) {
    return TaskSelector.select(user, date, TaskRules.candidates(EVERYTHING), last, 4);
  }

  @Test
  void theSameUserAndDateAlwaysGetTheSameTasks() {
    for (long user = 1; user <= 30; user++) {
      assertThat(pick(user, DAY, Map.of())).isEqualTo(pick(user, DAY, Map.of()));
    }
  }

  @Test
  void differentDaysAndUsersVary() {
    Set<List<String>> lists = new HashSet<>();
    for (int d = 0; d < 20; d++) {
      lists.add(pick(7, DAY.plusDays(d), Map.of()).stream().map(DailyTask::key).toList());
    }
    assertThat(lists.size()).isGreaterThan(5);
  }

  @Test
  void noCategoryIsUsedTwiceAndFourAreChosen() {
    for (long user = 1; user <= 100; user++) {
      List<DailyTask> tasks = pick(user, DAY.plusDays(user), Map.of());
      assertThat(tasks).hasSize(4);
      assertThat(tasks.stream().map(t -> t.type().category()).distinct()).hasSize(4);
      assertThat(tasks).noneMatch(t -> t.type() == TaskType.STUDY_PLAN);
      assertThat(tasks)
          .filteredOn(t -> t.type().needsGame())
          .allSatisfy(t -> assertThat(TaskRules.GAMES).contains(t.param()));
    }
  }

  @Test
  void fewerTasksWhenFewerCategoriesArePossible() {
    TaskFacts bare = new TaskFacts(20, 0, 0, 0, 0, false, false);
    assertThat(TaskSelector.select(1, DAY, TaskRules.candidates(bare), Map.of(), 4))
        .extracting(DailyTask::type)
        .containsExactly(TaskType.ADD_WORDS);
  }

  @Test
  void aCategoryNotDoneForLongerIsPickedMoreOften() {
    // STUDY was never done. Pick a single task over many days: STUDY should dominate.
    int study = 0;
    int video = 0;
    for (int d = 0; d < 400; d++) {
      LocalDate date = DAY.plusDays(d);
      Map<TaskCategory, LocalDate> last = new EnumMap<>(TaskCategory.class);
      last.put(TaskCategory.VIDEO, date.minusDays(1));
      last.put(TaskCategory.GAMES, date.minusDays(1));
      last.put(TaskCategory.READING, date.minusDays(1));
      last.put(TaskCategory.ADD_WORDS, date.minusDays(1));
      DailyTask first =
          TaskSelector.select(5, date, TaskRules.candidates(EVERYTHING), last, 1).get(0);
      if (first.type().category() == TaskCategory.STUDY) {
        study++;
      }
      if (first.type().category() == TaskCategory.VIDEO) {
        video++;
      }
    }
    assertThat(study).isGreaterThan(video * 5);
  }

  @Test
  void weightGrowsWithDaysSinceTheLastCompletedTask() {
    assertThat(TaskSelector.weight(DAY, null)).isEqualTo(15);
    assertThat(TaskSelector.weight(DAY, DAY.minusDays(1))).isEqualTo(1);
    assertThat(TaskSelector.weight(DAY, DAY.minusDays(5))).isEqualTo(5);
    assertThat(TaskSelector.weight(DAY, DAY.minusDays(100))).isEqualTo(15);
  }

  // ---- streak ----

  @Test
  void streakCountsConsecutiveDaysAndIsKeptUntilTheDayEnds() {
    Set<LocalDate> done = Set.of(DAY.minusDays(3), DAY.minusDays(2), DAY.minusDays(1));
    assertThat(Streak.current(done, DAY)).as("today still to do").isEqualTo(3);
    assertThat(
            Streak.current(Set.of(DAY.minusDays(3), DAY.minusDays(2), DAY.minusDays(1), DAY), DAY))
        .isEqualTo(4);
    assertThat(Streak.current(Set.of(DAY.minusDays(2)), DAY)).as("a missed day").isZero();
    assertThat(Streak.endingOn(done, DAY)).isZero();
    assertThat(Streak.endingOn(done, DAY.minusDays(1))).isEqualTo(3);
  }

  @Test
  void bestStreakLooksAtAllRuns() {
    Set<LocalDate> done =
        Set.of(
            DAY.minusDays(20),
            DAY.minusDays(19),
            DAY.minusDays(18),
            DAY.minusDays(17),
            DAY.minusDays(5),
            DAY.minusDays(4));
    assertThat(Streak.best(done)).isEqualTo(4);
    assertThat(Streak.best(Set.of())).isZero();
    assertThat(Streak.BONUS_DAYS).containsExactly(3, 7, 14, 30);
  }
}
