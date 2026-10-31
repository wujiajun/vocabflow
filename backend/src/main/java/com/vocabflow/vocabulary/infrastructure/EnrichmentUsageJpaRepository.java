package com.vocabflow.vocabulary.infrastructure;

import java.time.LocalDate;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface EnrichmentUsageJpaRepository extends JpaRepository<EnrichmentUsageEntity, Long> {
  Optional<EnrichmentUsageEntity> findByUserIdAndUsageDate(Long userId, LocalDate usageDate);

  @Transactional
  @Modifying(clearAutomatically = true, flushAutomatically = true)
  @Query(
      """
      update EnrichmentUsageEntity u
         set u.requestCount = u.requestCount + 1
       where u.userId = :userId and u.usageDate = :day and u.requestCount < :limit
      """)
  int increment(
      @Param("userId") long userId, @Param("day") LocalDate day, @Param("limit") int limit);
}
