package com.vocabflow.learning.infrastructure;

import com.vocabflow.learning.application.GameRounds;
import com.vocabflow.learning.domain.GameRound;
import java.time.LocalDate;
import org.springframework.stereotype.Repository;

@Repository
public class JpaGameRounds implements GameRounds {
  private final GameRoundJpaRepository rounds;

  public JpaGameRounds(GameRoundJpaRepository rounds) {
    this.rounds = rounds;
  }

  @Override
  public long save(GameRound round) {
    GameRoundEntity entity = new GameRoundEntity();
    entity.userId = round.userId();
    entity.game = round.game().id();
    entity.stars = round.stars();
    entity.mistakes = round.mistakes();
    entity.wordCount = round.wordCount();
    entity.studyDate = round.studyDate();
    entity.finishedAt = round.finishedAt();
    return rounds.save(entity).id;
  }

  @Override
  public int countRounds(long userId, LocalDate date) {
    return rounds.countByUserIdAndStudyDate(userId, date);
  }

  @Override
  public int bestStars(long userId, LocalDate date) {
    return rounds.bestStars(userId, date);
  }
}
