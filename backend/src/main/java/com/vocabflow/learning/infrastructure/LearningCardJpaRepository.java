package com.vocabflow.learning.infrastructure;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LearningCardJpaRepository extends JpaRepository<LearningCardEntity, Long> {
  List<LearningCardEntity> findByUserIdAndStateInOrderByDueAtAscIdAsc(
      Long userId, Collection<String> states);

  List<LearningCardEntity> findByUserIdAndStateAndDueDateLessThanEqualOrderByDueDateAscIdAsc(
      Long userId, String state, LocalDate date);

  boolean existsByUserIdAndUserVocabularyId(Long userId, Long userVocabularyId);

  List<LearningCardEntity> findByUserIdAndUserVocabularyIdIn(Long userId, Collection<Long> ids);

  /** Cards of words whose content is COMPLETED (native: the vocabulary tables are not ours). */
  @Query(
      value =
          """
          SELECT COUNT(*) FROM learning_cards c
            JOIN user_vocabularies uv ON uv.id = c.user_vocabulary_id
            JOIN vocabulary_items vi ON vi.id = uv.vocabulary_item_id
           WHERE c.user_id = :userId AND vi.enrichment_status = 'COMPLETED'
          """,
      nativeQuery = true)
  int countStarted(@Param("userId") long userId);

  @Query(
      value =
          """
          SELECT COUNT(*) FROM learning_cards c
            JOIN user_vocabularies uv ON uv.id = c.user_vocabulary_id
            JOIN vocabulary_items vi ON vi.id = uv.vocabulary_item_id
           WHERE c.user_id = :userId AND vi.enrichment_status = 'COMPLETED'
             AND c.state = 'REVIEW' AND c.interval_days >= :minInterval
          """,
      nativeQuery = true)
  int countMature(@Param("userId") long userId, @Param("minInterval") int minInterval);
}
