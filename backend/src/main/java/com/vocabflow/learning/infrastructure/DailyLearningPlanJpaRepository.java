package com.vocabflow.learning.infrastructure;

import java.time.LocalDate;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DailyLearningPlanJpaRepository
    extends JpaRepository<DailyLearningPlanEntity, Long> {
  Optional<DailyLearningPlanEntity> findByUserIdAndLearningDate(
      long userId, LocalDate learningDate);
}
