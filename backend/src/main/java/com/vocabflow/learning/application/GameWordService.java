package com.vocabflow.learning.application;

import com.vocabflow.learning.domain.GameWordScorer;
import com.vocabflow.shared.web.NotFoundException;
import com.vocabflow.vocabulary.application.LearningVocabularyQuery;
import com.vocabflow.vocabulary.domain.EnrichmentStatus;
import com.vocabflow.vocabulary.domain.StudyContent;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;
import org.springframework.stereotype.Service;

/**
 * Chooses and remembers the words of the practice games. Practice only: nothing here touches cards
 * or review logs. Not transactional, because recording a play catches a duplicate-key error.
 */
@Service
public class GameWordService {
  /** How many ranked words a game gets: a round's worth and spares for words it cannot use. */
  public static final int CANDIDATES = 15;

  public static final int MAX_PLAYED_AT_ONCE = 30;

  private final ReviewCardRepository cards;
  private final LearningVocabularyQuery vocabulary;
  private final GameWordPlays plays;
  private final Clock clock;

  public GameWordService(
      ReviewCardRepository cards,
      LearningVocabularyQuery vocabulary,
      GameWordPlays plays,
      Clock clock) {
    this.cards = cards;
    this.vocabulary = vocabulary;
    this.plays = plays;
    this.clock = clock;
  }

  /**
   * The words studied today or in the {@value StudyService#RECENT_DAYS} days before, whose details
   * are complete, best first for the next round.
   */
  public List<Long> ranked(long userId, LocalDate date) {
    List<Long> studied =
        cards.findStudiedBetween(userId, date.minusDays(StudyService.RECENT_DAYS), date);
    Map<Long, StudyContent> contents = vocabulary.findStudyContent(userId, studied);
    List<Long> usable =
        studied.stream()
            .distinct()
            .filter(
                id ->
                    contents.get(id) != null
                        && contents.get(id).enrichmentStatus() == EnrichmentStatus.COMPLETED)
            .toList();
    if (usable.isEmpty()) {
      return List.of();
    }
    Set<Long> today = new LinkedHashSet<>(cards.findStudiedOn(userId, date));
    Map<Long, Instant> played = plays.lastPlayed(userId, usable);
    Map<Long, RatingCounts> counts = cards.findRatingCounts(userId, usable);
    Map<Long, StoredCard> stored = cards.findByUserVocabularyIds(userId, usable);
    List<GameWordScorer.Candidate> candidates =
        usable.stream()
            .map(
                id -> {
                  RatingCounts rated = counts.getOrDefault(id, new RatingCounts(0, 0, 0));
                  StoredCard card = stored.get(id);
                  return new GameWordScorer.Candidate(
                      id,
                      played.get(id),
                      today.contains(id),
                      rated.total(),
                      rated.again(),
                      rated.hard(),
                      card == null ? 0 : card.card().lapses(),
                      card == null
                          ? GameWordScorer.START_EASE_PERMILLE
                          : card.card().easePermille());
                })
            .toList();
    return GameWordScorer.rank(
        candidates, CANDIDATES, () -> ThreadLocalRandom.current().nextDouble());
  }

  /** Notes that a round used these words; every id must be one of the user's own words. */
  public void played(long userId, List<Long> ids) {
    List<Long> distinct = ids.stream().distinct().toList();
    if (distinct.isEmpty()
        || vocabulary.findStudyContent(userId, distinct).size() != distinct.size()) {
      throw new NotFoundException("Vocabulary was not found");
    }
    plays.record(userId, distinct, clock.instant());
  }
}
