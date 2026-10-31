package com.vocabflow.learning.application;

import com.vocabflow.learning.domain.*;
import com.vocabflow.shared.web.ConflictException;
import com.vocabflow.shared.web.NotFoundException;
import com.vocabflow.vocabulary.application.LearningVocabularyQuery;
import com.vocabflow.vocabulary.domain.EnrichmentStatus;
import com.vocabflow.vocabulary.domain.StudyContent;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;

/**
 * Deliberately not transactional: creating a card catches a duplicate-key error, and the daily plan
 * path manages its own transactions. Both must stay outside any shared transaction.
 */
@Service
public class StudyService {
  // As in Anki: with nothing else left, a learning step this close is shown early instead of making
  // the learner wait for it.
  static final Duration LEARN_AHEAD = Duration.ofMinutes(20);

  private final DailyLearningPlanService plans;
  private final ReviewCardRepository cards;
  private final LearningVocabularyQuery vocabulary;
  private final ReviewTransaction reviewTransaction;
  private final Clock clock;

  public StudyService(
      DailyLearningPlanService plans,
      ReviewCardRepository cards,
      LearningVocabularyQuery vocabulary,
      ReviewTransaction reviewTransaction,
      Clock clock) {
    this.plans = plans;
    this.cards = cards;
    this.vocabulary = vocabulary;
    this.reviewTransaction = reviewTransaction;
    this.clock = clock;
  }

  public StudyQueue next(long userId, LocalDate requestedDate) {
    DailyLearningPlan plan = plans.getOrCreate(userId, requestedDate);
    LocalDate date = plan.learningDate();
    Instant now = clock.instant();

    List<StoredCard> inLearning = cards.findInLearning(userId);
    List<StoredCard> dueReviews = cards.findDueReviews(userId, date);
    List<Long> planned =
        plan.newItems().stream().map(DailyLearningPlanItem::userVocabularyId).toList();
    Map<Long, StoredCard> plannedCards = cards.findByUserVocabularyIds(userId, planned);
    // A planned word is new until its first rating; a stored card in NEW has not been rated yet.
    List<StoredCard> newCards =
        planned.stream()
            .map(id -> plannedCards.getOrDefault(id, new StoredCard(id, ReviewCard.newCard(), 0)))
            .filter(stored -> stored.card().state() == CardState.NEW)
            .toList();

    Set<Long> ids = new LinkedHashSet<>();
    for (List<StoredCard> group : List.of(inLearning, dueReviews, newCards)) {
      group.forEach(stored -> ids.add(stored.userVocabularyId()));
    }
    Map<Long, StudyContent> contents = vocabulary.findStudyContent(userId, ids);
    int unavailable = (int) ids.stream().filter(id -> !studyable(contents.get(id))).count();

    List<StoredCard> learning = onlyStudyable(inLearning, contents);
    List<StoredCard> reviews = onlyStudyable(dueReviews, contents);
    List<StoredCard> fresh = onlyStudyable(newCards, contents);
    Instant aheadLimit = now.plus(LEARN_AHEAD);
    List<StoredCard> learningDue = dueBy(learning, now);
    List<StoredCard> learningAhead = dueBy(learning, aheadLimit);

    Optional<StoredCard> next =
        learningDue.stream()
            .findFirst()
            .or(() -> reviews.stream().findFirst())
            .or(() -> fresh.stream().findFirst())
            .or(() -> learningAhead.stream().findFirst());
    Instant nextDueAt =
        next.isPresent() || learning.isEmpty() ? null : learning.getFirst().card().dueAt();

    return new StudyQueue(
        date,
        learningAhead.size(),
        reviews.size(),
        fresh.size(),
        unavailable,
        next.map(stored -> nextCard(stored, contents, now, date)).orElse(null),
        nextDueAt);
  }

  public StudyQueue review(
      long userId, long userVocabularyId, Rating rating, int version, LocalDate date) {
    if (vocabulary.findStudyContent(userId, List.of(userVocabularyId)).isEmpty()) {
      throw new NotFoundException("Vocabulary was not found");
    }
    Instant now = clock.instant();
    cards.createIfAbsent(userId, userVocabularyId, now);
    try {
      reviewTransaction.apply(userId, userVocabularyId, rating, version, now, date);
    } catch (OptimisticLockingFailureException raced) {
      throw new ConflictException(ReviewTransaction.OUT_OF_DATE);
    }
    return next(userId, date);
  }

  private static boolean studyable(StudyContent content) {
    return content != null && content.enrichmentStatus() == EnrichmentStatus.COMPLETED;
  }

  private static List<StoredCard> onlyStudyable(
      List<StoredCard> group, Map<Long, StudyContent> contents) {
    return group.stream().filter(s -> studyable(contents.get(s.userVocabularyId()))).toList();
  }

  private static List<StoredCard> dueBy(List<StoredCard> learning, Instant limit) {
    return learning.stream().filter(s -> !s.card().dueAt().isAfter(limit)).toList();
  }

  private static StudyQueue.NextCard nextCard(
      StoredCard stored, Map<Long, StudyContent> contents, Instant now, LocalDate date) {
    Map<Rating, ReviewCard> outcomes = new EnumMap<>(Rating.class);
    for (Rating rating : Rating.values()) {
      outcomes.put(rating, SpacedRepetitionScheduler.schedule(stored.card(), rating, now, date));
    }
    return new StudyQueue.NextCard(
        contents.get(stored.userVocabularyId()), stored.version(), stored.card(), now, outcomes);
  }
}
