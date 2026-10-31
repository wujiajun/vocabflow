package com.vocabflow.learning.infrastructure;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LearningCardJpaRepository extends JpaRepository<LearningCardEntity, Long> {
  List<LearningCardEntity> findByUserIdAndStateInOrderByDueAtAscIdAsc(
      Long userId, Collection<String> states);

  List<LearningCardEntity> findByUserIdAndStateAndDueDateLessThanEqualOrderByDueDateAscIdAsc(
      Long userId, String state, LocalDate date);

  List<LearningCardEntity> findByUserIdAndUserVocabularyIdIn(Long userId, Collection<Long> ids);
}
