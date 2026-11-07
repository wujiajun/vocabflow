package com.vocabflow.learning.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.vocabflow.learning.domain.GameWordScorer.Candidate;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import org.junit.jupiter.api.Test;

class GameWordScorerTest {
  private static final Instant T0 = Instant.parse("2026-11-01T10:00:00Z");

  private static Candidate plain(long id, Instant played) {
    return new Candidate(id, played, false, 3, 0, 0, 0, 2500);
  }

  private static List<Long> rank(List<Candidate> words, int limit) {
    return GameWordScorer.rank(words, limit, () -> 0);
  }

  @Test
  void wordsNeverPlayedComeBeforeEveryPlayedWord() {
    List<Long> ranked =
        rank(
            List.of(
                plain(1, T0), plain(2, null), plain(3, T0.minusSeconds(86_400)), plain(4, null)),
            4);
    assertThat(ranked.subList(0, 2)).containsExactlyInAnyOrder(2L, 4L);
  }

  @Test
  void playedWordsComeOldestRoundFirstAndTheLastRoundLast() {
    List<Long> ranked =
        rank(
            List.of(
                plain(1, T0.plusSeconds(300)),
                plain(2, T0),
                plain(3, T0.plusSeconds(600)),
                plain(4, T0.plusSeconds(300))),
            4);
    assertThat(ranked.getFirst()).isEqualTo(2L);
    assertThat(ranked.getLast()).isEqualTo(3L);
    assertThat(ranked.subList(1, 3)).containsExactlyInAnyOrder(1L, 4L);
  }

  @Test
  void hardWordsGetABonusAmongOtherwiseEqualWords() {
    Candidate hard = new Candidate(1, T0, false, 6, 3, 2, 2, 1500);
    assertThat(GameWordScorer.hardness(hard)).isEqualTo(1.0);
    assertThat(rank(List.of(plain(2, T0), hard, plain(3, T0)), 3).getFirst()).isEqualTo(1L);
  }

  @Test
  void aHardWordPlayedInTheLastRoundDoesNotComeBackBeforeOlderOrNewWords() {
    Candidate hardJustPlayed = new Candidate(1, T0.plusSeconds(600), true, 6, 3, 2, 2, 1500);
    List<Candidate> words = new ArrayList<>(List.of(hardJustPlayed));
    words.add(plain(2, null));
    words.add(plain(3, T0));
    words.add(plain(4, T0.plusSeconds(300)));
    List<Long> ranked = rank(words, 4);
    assertThat(ranked.getLast()).isEqualTo(1L);
  }

  @Test
  void aHardBonusNeverBeatsAWordThatWasNeverPlayed() {
    Candidate hardOldest = new Candidate(1, T0, true, 9, 5, 4, 5, 1300);
    Candidate neverPlayed = plain(2, null);
    List<Long> ranked = rank(List.of(hardOldest, neverPlayed, plain(3, T0.plusSeconds(60))), 3);
    assertThat(ranked.getFirst()).isEqualTo(2L);
  }

  @Test
  void aWordWithoutRatingsIsNeverHard() {
    Candidate unrated = new Candidate(1, null, false, 0, 5, 5, 5, 1300);
    assertThat(GameWordScorer.hardness(unrated)).isZero();
    assertThat(GameWordScorer.hardness(plain(2, null))).isZero();
  }

  @Test
  void hardnessGrowsWithAgainHardLapsesAndLowEase() {
    double again = GameWordScorer.hardness(new Candidate(1, null, false, 1, 1, 0, 0, 2500));
    double hard = GameWordScorer.hardness(new Candidate(1, null, false, 1, 0, 1, 0, 2500));
    double lapse = GameWordScorer.hardness(new Candidate(1, null, false, 1, 0, 0, 1, 2500));
    double lowEase = GameWordScorer.hardness(new Candidate(1, null, false, 1, 0, 0, 0, 2300));
    assertThat(again).isGreaterThan(lapse).isGreaterThan(hard);
    assertThat(lapse).isGreaterThan(lowEase);
    assertThat(lowEase).isGreaterThan(0);
  }

  @Test
  void wordsStudiedTodayGetASmallBonus() {
    Candidate today = new Candidate(1, T0, true, 3, 0, 0, 0, 2500);
    assertThat(rank(List.of(plain(2, T0), today), 2).getFirst()).isEqualTo(1L);
  }

  @Test
  void theLimitCutsTheList() {
    List<Candidate> words = new ArrayList<>();
    for (long id = 1; id <= 20; id++) {
      words.add(plain(id, null));
    }
    assertThat(rank(words, 15)).hasSize(15).doesNotHaveDuplicates();
    assertThat(rank(List.of(), 15)).isEmpty();
  }

  @Test
  void randomnessOnlyReordersNearlyEqualScores() {
    List<Candidate> words = List.of(plain(1, null), plain(2, null), plain(3, T0));
    Random random = new Random(7);
    for (int i = 0; i < 50; i++) {
      assertThat(GameWordScorer.rank(words, 3, random::nextDouble).getLast()).isEqualTo(3L);
    }
  }

  /**
   * Honest simulation, printed for the pull request: 40 candidate words (12 studied today, 8 of
   * them with a bad record), 10 words per round, 4 rounds in a row, 200 repeats. "Before" is the
   * picking of PR 92: today's words shuffled first, topped up with the others, the first ten used.
   */
  @Test
  void fourRoundsInARowReachMoreDifferentWordsThanBefore() {
    int repeats = 200;
    double before = 0;
    double after = 0;
    int afterMin = Integer.MAX_VALUE;
    for (int seed = 0; seed < repeats; seed++) {
      Random random = new Random(seed);
      before += distinctBefore(random);
      int distinct = distinctAfter(random);
      after += distinct;
      afterMin = Math.min(afterMin, distinct);
    }
    System.out.printf(
        "SIMULATION 40 words, 10 per round, 4 rounds: before %.1f distinct words, after %.1f (worst case %d)%n",
        before / repeats, after / repeats, afterMin);
    assertThat(before / repeats).isLessThan(20);
    assertThat(after / repeats).isEqualTo(40.0);
  }

  private static List<Candidate> pool(Map<Long, Instant> played) {
    List<Candidate> pool = new ArrayList<>();
    for (long id = 1; id <= 40; id++) {
      boolean today = id <= 12;
      boolean bad = id <= 8;
      pool.add(
          new Candidate(
              id,
              played.get(id),
              today,
              4,
              bad ? 2 : 0,
              bad ? 1 : 0,
              bad ? 1 : 0,
              bad ? 1900 : 2500));
    }
    return pool;
  }

  private static int distinctAfter(Random random) {
    Map<Long, Instant> played = new HashMap<>();
    Set<Long> seen = new HashSet<>();
    for (int round = 0; round < 4; round++) {
      List<Long> used = GameWordScorer.rank(pool(played), 15, random::nextDouble).subList(0, 10);
      Instant at = T0.plusSeconds(600L * round);
      used.forEach(id -> played.put(id, at));
      seen.addAll(used);
    }
    return seen.size();
  }

  private static int distinctBefore(Random random) {
    Set<Long> seen = new HashSet<>();
    for (int round = 0; round < 4; round++) {
      List<Long> today =
          new ArrayList<>(List.of(1L, 2L, 3L, 4L, 5L, 6L, 7L, 8L, 9L, 10L, 11L, 12L));
      Collections.shuffle(today, random);
      List<Long> recent = new ArrayList<>();
      for (long id = 13; id <= 40; id++) {
        recent.add(id);
      }
      Collections.shuffle(recent, random);
      List<Long> fetched = new ArrayList<>(today);
      fetched.addAll(recent);
      seen.addAll(fetched.subList(0, 10));
    }
    return seen.size();
  }
}
