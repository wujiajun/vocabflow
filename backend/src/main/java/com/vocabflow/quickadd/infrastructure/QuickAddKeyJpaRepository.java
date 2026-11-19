package com.vocabflow.quickadd.infrastructure;

import java.time.Instant;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface QuickAddKeyJpaRepository extends JpaRepository<QuickAddKeyEntity, Long> {
  Optional<QuickAddKeyEntity> findByUserId(Long userId);

  Optional<QuickAddKeyEntity> findByKeyHash(String keyHash);

  @Modifying
  @Transactional
  @Query("update QuickAddKeyEntity e set e.lastUsedAt = :at where e.keyHash = :hash")
  int markUsed(@Param("hash") String hash, @Param("at") Instant at);

  @Modifying
  @Transactional
  @Query("delete from QuickAddKeyEntity e where e.userId = :userId")
  int deleteByUser(@Param("userId") Long userId);
}
