package com.vocabflow.learning.application;

import com.vocabflow.learning.domain.GameRound;
import com.vocabflow.shared.web.BadRequestException;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import org.springframework.stereotype.Service;

/** Logs finished practice-game rounds. Not transactional: one plain insert. */
@Service
public class GameRoundService {
  private final GameRounds rounds;
  private final Clock clock;

  public GameRoundService(GameRounds rounds, Clock clock) {
    this.rounds = rounds;
    this.clock = clock;
  }

  /** Records a finished round for the user; the study date may differ from UTC's by one day. */
  public long record(
      long userId, String game, int stars, int mistakes, int wordCount, LocalDate date) {
    GameRound.Game id =
        GameRound.Game.fromId(game).orElseThrow(() -> new BadRequestException("Unknown game"));
    LocalDate utcToday = LocalDate.now(clock.withZone(ZoneOffset.UTC));
    if (date == null || Math.abs(ChronoUnit.DAYS.between(utcToday, date)) > 1) {
      throw new BadRequestException("Date is out of range");
    }
    try {
      return rounds.save(
          new GameRound(userId, id, stars, mistakes, wordCount, date, clock.instant()));
    } catch (IllegalArgumentException invalid) {
      throw new BadRequestException(invalid.getMessage());
    }
  }

  public int countRounds(long userId, LocalDate date) {
    return rounds.countRounds(userId, date);
  }

  public int bestStars(long userId, LocalDate date) {
    return rounds.bestStars(userId, date);
  }
}
