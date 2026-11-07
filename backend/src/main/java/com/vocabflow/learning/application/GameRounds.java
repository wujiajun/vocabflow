package com.vocabflow.learning.application;

import com.vocabflow.learning.domain.GameRound;
import java.time.LocalDate;

/** The log of finished practice-game rounds, per user. */
public interface GameRounds {
  /** Stores the round and returns its id. A plain insert, safe in any transaction. */
  long save(GameRound round);

  /** How many rounds the user finished on the study date. */
  int countRounds(long userId, LocalDate date);

  /** The most stars any round of that study date earned; 0 when there was none. */
  int bestStars(long userId, LocalDate date);
}
