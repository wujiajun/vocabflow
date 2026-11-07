package com.vocabflow.learning.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.Optional;

/** One finished round of a practice game. Practice only: it never touches the review schedule. */
public record GameRound(
    long userId,
    Game game,
    int stars,
    int mistakes,
    int wordCount,
    LocalDate studyDate,
    Instant finishedAt) {
  public static final int MAX_STARS = 3;
  public static final int MAX_MISTAKES = 1000;
  public static final int MAX_WORDS = 50;

  /** The four practice games, by the id the client sends. */
  public enum Game {
    QUICK_REVIEW("quick-review"),
    FILL_BLANK("fill-blank"),
    LISTEN_CHOOSE("listen-choose"),
    SPELL_IT("spell-it");

    private final String id;

    Game(String id) {
      this.id = id;
    }

    public String id() {
      return id;
    }

    public static Optional<Game> fromId(String id) {
      return Arrays.stream(values()).filter(g -> g.id.equals(id)).findFirst();
    }
  }

  public GameRound {
    if (game == null || studyDate == null || finishedAt == null) {
      throw new IllegalArgumentException("Game, date and finish time are required");
    }
    if (stars < 0 || stars > MAX_STARS) {
      throw new IllegalArgumentException("Stars must be between 0 and " + MAX_STARS);
    }
    if (mistakes < 0 || mistakes > MAX_MISTAKES) {
      throw new IllegalArgumentException("Mistakes must be between 0 and " + MAX_MISTAKES);
    }
    if (wordCount < 1 || wordCount > MAX_WORDS) {
      throw new IllegalArgumentException("Word count must be between 1 and " + MAX_WORDS);
    }
  }
}
