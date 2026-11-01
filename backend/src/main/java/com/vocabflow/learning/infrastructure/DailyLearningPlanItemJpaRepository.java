package com.vocabflow.learning.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DailyLearningPlanItemJpaRepository
    extends JpaRepository<DailyLearningPlanItemEntity, Long> {
  @Modifying(flushAutomatically = true, clearAutomatically = true)
  @Query(
      """
      delete from DailyLearningPlanItemEntity i
       where i.userVocabularyId = :userVocabularyId
         and i.plan.id in (select p.id from DailyLearningPlanEntity p where p.userId = :userId)
      """)
  int deleteForWord(@Param("userId") long userId, @Param("userVocabularyId") long userVocabularyId);
}
