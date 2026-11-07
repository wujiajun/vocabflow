package com.vocabflow.learning.domain;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.TreeSet;
import java.util.function.DoubleSupplier;

/**
 * Ranks the words the practice games may use, best first. Coverage comes first: a word never played
 * outranks any played one, and played words come back oldest round first, the last round last. The
 * hard-word bonus is smaller than the gap between a never-played and an oldest-played word, so
 * rotation always wins over hardness; a little randomness keeps near-equal scores from looking
 * mechanical. Pure and deterministic given the random source.
 */
public final class GameWordScorer {
  /** A word that was never played in any game. */
  public static final double NEVER_PLAYED = 100;

  /** A played word scores up to this, the oldest round highest and the latest round zero. */
  public static final double PLAYED_MAX = 80;

  /** The most a hard word gains, at full hardness. */
  public static final double HARD_MAX = 15;

  /** A word studied today. */
  public static final double TODAY_BONUS = 8;

  /** Random addition below this, so equal scores are not always ordered the same way. */
  public static final double JITTER = 3;

  /** Hardness points that count as fully hard. */
  public static final double HARD_SATURATION = 10;

  public static final int AGAIN_POINTS = 3;
  public static final int HARD_POINTS = 1;
  public static final int LAPSE_POINTS = 2;

  /** One point for every this many permille of ease below the starting 2500. */
  public static final double EASE_STEP = 200;

  public static final int START_EASE_PERMILLE = 2500;

  /**
   * {@code lastPlayedAt} is null for a word never played. {@code ratings} is how many times the
   * learner has rated it; a word with none is never hard.
   */
  public record Candidate(
      long id,
      Instant lastPlayedAt,
      boolean studiedToday,
      int ratings,
      int again,
      int hard,
      int lapses,
      int easePermille) {}

  private GameWordScorer() {}

  /** 0 (not hard, or never rated) to 1 (very hard), from the learner's own ratings. */
  public static double hardness(Candidate word) {
    if (word.ratings() <= 0) {
      return 0;
    }
    double points =
        word.again() * AGAIN_POINTS
            + word.hard() * HARD_POINTS
            + word.lapses() * LAPSE_POINTS
            + Math.max(0, START_EASE_PERMILLE - word.easePermille()) / EASE_STEP;
    return Math.min(1, points / HARD_SATURATION);
  }

  /** The ids of the best {@code limit} candidates, best first. */
  public static List<Long> rank(List<Candidate> candidates, int limit, DoubleSupplier random) {
    TreeSet<Instant> rounds = new TreeSet<>();
    candidates.stream().map(Candidate::lastPlayedAt).filter(t -> t != null).forEach(rounds::add);
    List<Instant> ordered = List.copyOf(rounds);
    record Scored(long id, double score) {}
    return candidates.stream()
        .map(
            word ->
                new Scored(
                    word.id(),
                    rotation(word, ordered)
                        + hardness(word) * HARD_MAX
                        + (word.studiedToday() ? TODAY_BONUS : 0)
                        + random.getAsDouble() * JITTER))
        .sorted(Comparator.comparingDouble(Scored::score).reversed())
        .limit(limit)
        .map(Scored::id)
        .toList();
  }

  private static double rotation(Candidate word, List<Instant> rounds) {
    if (word.lastPlayedAt() == null) {
      return NEVER_PLAYED;
    }
    int position = rounds.indexOf(word.lastPlayedAt());
    return PLAYED_MAX * (rounds.size() - 1 - position) / rounds.size();
  }
}
