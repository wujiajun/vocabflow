package com.vocabflow.push.infrastructure;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

interface PushSubscriptionJpaRepository extends JpaRepository<PushSubscriptionEntity, Long> {
  Optional<PushSubscriptionEntity> findByEndpoint(String endpoint);

  List<PushSubscriptionEntity> findByUserIdOrderById(Long userId);

  @Modifying
  @Transactional
  long deleteByUserIdAndEndpoint(Long userId, String endpoint);

  @Modifying
  @Transactional
  @Query(
      "UPDATE PushSubscriptionEntity s SET s.lastSentDate = :date WHERE s.id = :id "
          + "AND (s.lastSentDate IS NULL OR s.lastSentDate <> :date)")
  int claim(@Param("id") Long id, @Param("date") LocalDate date);
}
