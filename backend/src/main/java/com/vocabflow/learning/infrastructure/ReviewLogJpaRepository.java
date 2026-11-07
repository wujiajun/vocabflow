package com.vocabflow.learning.infrastructure;

import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReviewLogJpaRepository extends JpaRepository<ReviewLogEntity, Long> {
  @Query(
      """
      select distinct r.userVocabularyId from ReviewLogEntity r
       where r.userId = :userId and r.reviewDate = :date and r.rating in ('AGAIN', 'HARD')
      """)
  List<Long> findStruggledOn(@Param("userId") long userId, @Param("date") LocalDate date);

  boolean existsByUserIdAndUserVocabularyId(Long userId, Long userVocabularyId);

  @Query(
      """
      select r.userVocabularyId from ReviewLogEntity r
       where r.userId = :userId and r.reviewDate = :date
       group by r.userVocabularyId
       order by min(r.id)
      """)
  List<Long> findStudiedOn(@Param("userId") long userId, @Param("date") LocalDate date);

  @Query(
      """
      select r.userVocabularyId from ReviewLogEntity r
       where r.userId = :userId and r.reviewDate between :from and :to
       group by r.userVocabularyId
       order by max(r.reviewDate) desc, max(r.id) desc
      """)
  List<Long> findStudiedBetween(
      @Param("userId") long userId, @Param("from") LocalDate from, @Param("to") LocalDate to);
}
