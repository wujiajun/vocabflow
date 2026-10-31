package com.vocabflow.learning.application;

import com.vocabflow.learning.domain.Rating;
import com.vocabflow.learning.domain.ReviewCard;
import com.vocabflow.learning.domain.SpacedRepetitionScheduler;
import com.vocabflow.shared.web.ConflictException;
import com.vocabflow.vocabulary.application.LearningVocabularyQuery;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** A separate bean so that the transaction applies: self-invocation would bypass it. */
@Service
public class ReviewTransaction {
  static final String OUT_OF_DATE = "This card has already been reviewed";

  private final ReviewCardRepository cards;
  private final LearningVocabularyQuery vocabulary;

  public ReviewTransaction(ReviewCardRepository cards, LearningVocabularyQuery vocabulary) {
    this.cards = cards;
    this.vocabulary = vocabulary;
  }

  // The new schedule, the log entry and the word's status are saved together or not at all.
  @Transactional
  public void apply(
      long userId,
      long userVocabularyId,
      Rating rating,
      int expectedVersion,
      Instant now,
      LocalDate today) {
    StoredCard stored =
        cards.findByUserVocabularyIds(userId, List.of(userVocabularyId)).get(userVocabularyId);
    if (stored == null) {
      throw new ConflictException(OUT_OF_DATE);
    }
    ReviewCard next = SpacedRepetitionScheduler.schedule(stored.card(), rating, now, today);
    if (!cards.update(userId, new StoredCard(userVocabularyId, next, expectedVersion))) {
      throw new ConflictException(OUT_OF_DATE);
    }
    cards.log(
        new ReviewLogEntry(userId, userVocabularyId, rating, stored.card(), next, today, now));
    vocabulary.updateLearningStatus(userId, userVocabularyId, next.learningStatus());
  }
}
