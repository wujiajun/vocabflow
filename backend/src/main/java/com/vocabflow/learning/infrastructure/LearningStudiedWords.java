package com.vocabflow.learning.infrastructure;

import com.vocabflow.learning.application.DailyLearningPlanRepository;
import com.vocabflow.learning.application.ReviewCardRepository;
import com.vocabflow.learning.application.StoredCard;
import com.vocabflow.learning.domain.CardState;
import com.vocabflow.reading.application.StudiedWords;
import com.vocabflow.reading.domain.StudiedWord;
import com.vocabflow.vocabulary.application.LearningVocabularyQuery;
import com.vocabflow.vocabulary.domain.StudyContent;
import com.vocabflow.vocabulary.domain.VocabularySense;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class LearningStudiedWords implements StudiedWords {
  // A word is described to the writer by its first meanings; the rest rarely matter in a passage.
  private static final int MAX_MEANINGS = 3;

  private final DailyLearningPlanRepository plans;
  private final ReviewCardRepository cards;
  private final LearningVocabularyQuery vocabulary;

  public LearningStudiedWords(
      DailyLearningPlanRepository plans,
      ReviewCardRepository cards,
      LearningVocabularyQuery vocabulary) {
    this.plans = plans;
    this.cards = cards;
    this.vocabulary = vocabulary;
  }

  @Override
  public boolean isFinished(long userId, LocalDate date) {
    return plans
        .findByUserIdAndLearningDate(userId, date)
        .map(plan -> plan.finishedAt() != null)
        .orElse(false);
  }

  @Override
  public List<StudiedWord> studiedOn(long userId, LocalDate date) {
    List<Long> studied = cards.findStudiedOn(userId, date);
    Set<Long> struggled = new HashSet<>(cards.findStruggledOn(userId, date));
    Map<Long, StudyContent> contents = vocabulary.findStudyContent(userId, studied);
    Map<Long, StoredCard> stored = cards.findByUserVocabularyIds(userId, studied);
    return studied.stream()
        .filter(contents::containsKey)
        .map(
            id ->
                new StudiedWord(
                    id,
                    contents.get(id).term(),
                    contents.get(id).senses().stream()
                        .limit(MAX_MEANINGS)
                        .map(LearningStudiedWords::describe)
                        .toList(),
                    struggled.contains(id),
                    stillLearning(stored.get(id))))
        .toList();
  }

  private static boolean stillLearning(StoredCard stored) {
    CardState state = stored.card().state();
    return state != CardState.REVIEW;
  }

  private static String describe(VocabularySense sense) {
    return sense.partOfSpeech() == null
        ? sense.definition()
        : sense.partOfSpeech() + ": " + sense.definition();
  }
}
