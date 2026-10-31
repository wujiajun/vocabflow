package com.vocabflow.learning.application;

import com.vocabflow.learning.domain.Rating;
import com.vocabflow.learning.domain.ReviewCard;
import com.vocabflow.vocabulary.domain.LearningStatus;
import com.vocabflow.vocabulary.domain.StudyContent;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * What to study now. {@code nextCard} is null when nothing is due; {@code nextDueAt} then says when
 * a learning step comes up, if any does. {@code unavailable} counts words that are waiting for
 * their details and so cannot be studied yet. {@code finished} means the day's study ended, so
 * words added from now on wait for the next batch or the next day.
 */
public record StudyQueue(
    LocalDate date,
    int learningCount,
    int reviewCount,
    int newCount,
    int unavailable,
    NextCard nextCard,
    Instant nextDueAt,
    int newStudied,
    int newTarget,
    int reviewsDone,
    boolean finished,
    boolean moreNewWords,
    List<StudiedWord> studiedToday) {
  public record StudiedWord(long userVocabularyId, String term, LearningStatus status) {}

  public record NextCard(
      StudyContent content,
      int version,
      ReviewCard card,
      Instant scheduledAt,
      Map<Rating, ReviewCard> outcomes) {}
}
