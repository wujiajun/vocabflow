package com.vocabflow.learning.infrastructure;

import com.vocabflow.learning.application.DailyLearningPlanRepository;
import com.vocabflow.learning.application.GameRounds;
import com.vocabflow.learning.application.GameWordService;
import com.vocabflow.learning.application.ReviewCardRepository;
import com.vocabflow.learning.domain.DailyLearningPlan;
import com.vocabflow.tasks.application.LearningActivity;
import com.vocabflow.tasks.domain.DayActivity;
import com.vocabflow.vocabulary.application.LearningVocabularyQuery;
import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Component;

/** Answers the daily tasks' questions from the learning data. Only reads; creates nothing. */
@Component
public class LearningTaskActivity implements LearningActivity {
  private final ReviewCardRepository cards;
  private final DailyLearningPlanRepository plans;
  private final GameRounds rounds;
  private final GameWordService gameWords;
  private final LearningVocabularyQuery vocabulary;

  public LearningTaskActivity(
      ReviewCardRepository cards,
      DailyLearningPlanRepository plans,
      GameRounds rounds,
      GameWordService gameWords,
      LearningVocabularyQuery vocabulary) {
    this.cards = cards;
    this.plans = plans;
    this.rounds = rounds;
    this.gameWords = gameWords;
    this.vocabulary = vocabulary;
  }

  @Override
  public int ratedCards(long userId, LocalDate date) {
    return cards.findStudiedOn(userId, date).size();
  }

  @Override
  public int dueReviews(long userId, LocalDate date) {
    return cards.findDueReviews(userId, date).size();
  }

  @Override
  public int newWordsAvailable(long userId, int limit) {
    return vocabulary.findNewVocabularyForUser(userId, limit).size();
  }

  @Override
  public boolean planFinished(long userId, LocalDate date) {
    return plans
        .findByUserIdAndLearningDate(userId, date)
        .map(DailyLearningPlan::finishedAt)
        .isPresent();
  }

  @Override
  public int gameWords(long userId, LocalDate date) {
    return gameWords.ranked(userId, date).size();
  }

  @Override
  public List<DayActivity.GameResult> rounds(long userId, LocalDate date) {
    return rounds.roundsOn(userId, date).stream()
        .map(r -> new DayActivity.GameResult(r.game().id(), r.stars()))
        .toList();
  }
}
