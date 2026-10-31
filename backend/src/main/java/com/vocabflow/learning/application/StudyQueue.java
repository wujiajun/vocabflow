package com.vocabflow.learning.application;

import com.vocabflow.learning.domain.Rating;
import com.vocabflow.learning.domain.ReviewCard;
import com.vocabflow.vocabulary.domain.StudyContent;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;

/**
 * What to study now. {@code nextCard} is null when nothing is due; {@code nextDueAt} then says when
 * a learning step comes up, if any does. {@code unavailable} counts words that are waiting for
 * their details and so cannot be studied yet.
 */
public record StudyQueue(
    LocalDate date,
    int learningCount,
    int reviewCount,
    int newCount,
    int unavailable,
    NextCard nextCard,
    Instant nextDueAt) {
  public record NextCard(
      StudyContent content,
      int version,
      ReviewCard card,
      Instant scheduledAt,
      Map<Rating, ReviewCard> outcomes) {}
}
