package com.vocabflow.learning.infrastructure;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface GameWordPlayJpaRepository extends JpaRepository<GameWordPlayEntity, Long> {
  List<GameWordPlayEntity> findByUserIdAndUserVocabularyIdIn(Long userId, Collection<Long> ids);

  /** Returns how many rows changed: 0 when the word has no row yet. */
  @Transactional
  @Modifying(flushAutomatically = true, clearAutomatically = true)
  @Query(
      """
      update GameWordPlayEntity p set p.lastPlayedAt = :now, p.playCount = p.playCount + 1
       where p.userId = :userId and p.userVocabularyId = :id
      """)
  int touch(@Param("userId") long userId, @Param("id") long id, @Param("now") Instant now);
}
