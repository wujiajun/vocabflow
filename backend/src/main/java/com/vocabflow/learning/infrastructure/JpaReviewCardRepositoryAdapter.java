package com.vocabflow.learning.infrastructure;

import com.vocabflow.learning.application.ReviewCardRepository;
import com.vocabflow.learning.application.ReviewLogEntry;
import com.vocabflow.learning.application.StoredCard;
import com.vocabflow.learning.domain.CardState;
import com.vocabflow.learning.domain.ReviewCard;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Repository;

@Repository
public class JpaReviewCardRepositoryAdapter implements ReviewCardRepository {
  private final LearningCardJpaRepository cards;
  private final ReviewLogJpaRepository logs;

  public JpaReviewCardRepositoryAdapter(
      LearningCardJpaRepository cards, ReviewLogJpaRepository logs) {
    this.cards = cards;
    this.logs = logs;
  }

  @Override
  public void createIfAbsent(long userId, long userVocabularyId, Instant now) {
    if (!cards.findByUserIdAndUserVocabularyIdIn(userId, List.of(userVocabularyId)).isEmpty()) {
      return;
    }
    LearningCardEntity entity = new LearningCardEntity();
    entity.userId = userId;
    entity.userVocabularyId = userVocabularyId;
    entity.createdAt = now;
    copy(ReviewCard.newCard(), entity);
    try {
      cards.saveAndFlush(entity);
    } catch (DataIntegrityViolationException raced) {
      // Only the unique key can fail here, because the service checked that the word is the user's:
      // another request created this card first, which is what this method asks for.
      if (cards.findByUserIdAndUserVocabularyIdIn(userId, List.of(userVocabularyId)).isEmpty()) {
        throw raced;
      }
    }
  }

  @Override
  public List<StoredCard> findInLearning(long userId) {
    return cards
        .findByUserIdAndStateInOrderByDueAtAscIdAsc(
            userId, List.of(CardState.LEARNING.name(), CardState.RELEARNING.name()))
        .stream()
        .map(this::map)
        .toList();
  }

  @Override
  public List<StoredCard> findDueReviews(long userId, LocalDate date) {
    return cards
        .findByUserIdAndStateAndDueDateLessThanEqualOrderByDueDateAscIdAsc(
            userId, CardState.REVIEW.name(), date)
        .stream()
        .map(this::map)
        .toList();
  }

  @Override
  public Map<Long, StoredCard> findByUserVocabularyIds(
      long userId, Collection<Long> userVocabularyIds) {
    if (userVocabularyIds.isEmpty()) {
      return Map.of();
    }
    return cards.findByUserIdAndUserVocabularyIdIn(userId, userVocabularyIds).stream()
        .map(this::map)
        .collect(Collectors.toMap(StoredCard::userVocabularyId, Function.identity()));
  }

  @Override
  public boolean update(long userId, StoredCard stored) {
    List<LearningCardEntity> found =
        cards.findByUserIdAndUserVocabularyIdIn(userId, List.of(stored.userVocabularyId()));
    if (found.isEmpty() || found.getFirst().version != stored.version()) {
      return false;
    }
    LearningCardEntity entity = found.getFirst();
    copy(stored.card(), entity);
    // A concurrent update makes this flush fail with an optimistic locking error.
    cards.saveAndFlush(entity);
    return true;
  }

  @Override
  public void log(ReviewLogEntry entry) {
    ReviewLogEntity entity = new ReviewLogEntity();
    entity.userId = entry.userId();
    entity.userVocabularyId = entry.userVocabularyId();
    entity.rating = entry.rating().name();
    entity.stateBefore = entry.before().state().name();
    entity.intervalBefore = entry.before().intervalDays();
    entity.easeBefore = entry.before().easePermille();
    entity.stateAfter = entry.after().state().name();
    entity.intervalAfter = entry.after().intervalDays();
    entity.easeAfter = entry.after().easePermille();
    entity.reviewDate = entry.reviewDate();
    entity.reviewedAt = entry.reviewedAt();
    logs.save(entity);
  }

  private void copy(ReviewCard card, LearningCardEntity entity) {
    entity.state = card.state().name();
    entity.stepIndex = card.stepIndex();
    entity.intervalDays = card.intervalDays();
    entity.easePermille = card.easePermille();
    entity.dueAt = card.dueAt();
    entity.dueDate = card.dueDate();
    entity.reps = card.reps();
    entity.lapses = card.lapses();
  }

  private StoredCard map(LearningCardEntity entity) {
    return new StoredCard(
        entity.userVocabularyId,
        new ReviewCard(
            CardState.valueOf(entity.state),
            entity.stepIndex,
            entity.intervalDays,
            entity.easePermille,
            entity.dueAt,
            entity.dueDate,
            entity.reps,
            entity.lapses),
        entity.version);
  }
}
