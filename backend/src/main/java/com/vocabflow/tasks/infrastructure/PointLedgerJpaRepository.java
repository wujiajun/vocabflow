package com.vocabflow.tasks.infrastructure;

import java.time.LocalDate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PointLedgerJpaRepository extends JpaRepository<PointLedgerEntity, Long> {
  @Query("select coalesce(sum(l.amount), 0) from PointLedgerEntity l where l.userId = :userId")
  long balance(@Param("userId") long userId);

  @Query(
      "select coalesce(sum(l.amount), 0) from PointLedgerEntity l "
          + "where l.userId = :userId and l.studyDate = :date")
  long earnedOn(@Param("userId") long userId, @Param("date") LocalDate date);

  boolean existsByUserIdAndStudyDateAndEntryKey(Long userId, LocalDate date, String key);

  Page<PointLedgerEntity> findByUserIdOrderByIdDesc(Long userId, Pageable pageable);
}
