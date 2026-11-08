package com.vocabflow.tasks.infrastructure;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface DailyTaskJpaRepository extends JpaRepository<DailyTaskEntity, Long> {
  List<DailyTaskEntity> findByUserIdAndStudyDateOrderByPosition(Long userId, LocalDate studyDate);

  @Modifying
  @Transactional
  @Query(
      "update DailyTaskEntity t set t.completedAt = :at where t.userId = :userId "
          + "and t.studyDate = :date and t.taskKey = :key and t.completedAt is null")
  int complete(
      @Param("userId") long userId,
      @Param("date") LocalDate date,
      @Param("key") String key,
      @Param("at") Instant at);

  @Query(
      "select t.category, max(t.studyDate) from DailyTaskEntity t where t.userId = :userId "
          + "and t.studyDate < :before and t.completedAt is not null group by t.category")
  List<Object[]> lastCompleted(@Param("userId") long userId, @Param("before") LocalDate before);

  @Query(
      "select t.studyDate from DailyTaskEntity t where t.userId = :userId "
          + "and t.taskType = 'STUDY_PLAN' and t.completedAt is not null")
  List<LocalDate> baseCompletedDays(@Param("userId") long userId);
}
