package com.vocabflow.learning.infrastructure;

import com.vocabflow.learning.domain.ReviewCard;
import com.vocabflow.progress.application.LearningProgress;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/** Answers the progress page's questions from the learning data. Only reads. */
@Component
public class LearningProgressAdapter implements LearningProgress {
  private final LearningCardJpaRepository cards;
  private final ReviewLogJpaRepository logs;
  private final GameRoundJpaRepository rounds;

  public LearningProgressAdapter(
      LearningCardJpaRepository cards, ReviewLogJpaRepository logs, GameRoundJpaRepository rounds) {
    this.cards = cards;
    this.logs = logs;
    this.rounds = rounds;
  }

  @Override
  public int startedWords(long userId) {
    return cards.countStarted(userId);
  }

  @Override
  public int masteredWords(long userId) {
    return cards.countMature(userId, ReviewCard.MATURE_INTERVAL_DAYS);
  }

  @Override
  public List<DayCards> cardsByDay(long userId, LocalDate from, LocalDate to) {
    return logs.countCardsByDay(userId, from, to).stream()
        .map(
            r ->
                new DayCards(
                    (LocalDate) r[0], ((Number) r[1]).intValue(), ((Number) r[2]).intValue()))
        .toList();
  }

  @Override
  public Map<LocalDate, Integer> roundsByDay(long userId, LocalDate from, LocalDate to) {
    Map<LocalDate, Integer> result = new HashMap<>();
    rounds
        .countByDay(userId, from, to)
        .forEach(r -> result.put((LocalDate) r[0], ((Number) r[1]).intValue()));
    return result;
  }
}
