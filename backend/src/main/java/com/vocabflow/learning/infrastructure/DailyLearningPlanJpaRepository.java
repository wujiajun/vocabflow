package com.vocabflow.learning.infrastructure;

import jakarta.persistence.LockModeType;
import java.time.LocalDate;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DailyLearningPlanJpaRepository
    extends JpaRepository<DailyLearningPlanEntity, Long> {
  Optional<DailyLearningPlanEntity> findByUserIdAndLearningDate(
      long userId, LocalDate learningDate);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query(
      "select p from DailyLearningPlanEntity p where p.userId = :userId and p.learningDate = :date")
  Optional<DailyLearningPlanEntity> findForUpdate(
      @Param("userId") long userId, @Param("date") LocalDate date);
}
