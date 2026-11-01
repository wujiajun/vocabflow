package com.vocabflow.vocabulary.infrastructure;

import java.time.Instant;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface VocabularyItemJpaRepository extends JpaRepository<VocabularyItemEntity, Long> {
  Optional<VocabularyItemEntity> findByNormalizedTerm(String s);

  @Query(
      "select e.id from VocabularyItemEntity e"
          + " where e.enrichmentStatus = 'COMPLETED' and e.senses is null order by e.id")
  List<Long> findCompletedIdsWithoutSenses();

  @Modifying(clearAutomatically = true, flushAutomatically = true)
  @Query(
      """
      delete from VocabularyItemEntity e
       where e.id = :id
         and not exists (select 1 from UserVocabularyEntity u where u.item.id = :id)
      """)
  int deleteIfUnused(@Param("id") long id);

  @Transactional
  @Modifying(clearAutomatically = true, flushAutomatically = true)
  @Query(
      """
      update VocabularyItemEntity e
         set e.enrichmentStatus = 'PROCESSING',
             e.enrichmentStartedAt = :now,
             e.enrichmentAttempts = e.enrichmentAttempts + 1
       where e.id = :id
         and (e.enrichmentStatus in :claimable
              or (e.enrichmentStatus = 'PROCESSING' and e.enrichmentStartedAt < :staleBefore))
      """)
  int claim(
      @Param("id") long id,
      @Param("claimable") Collection<String> claimable,
      @Param("now") Instant now,
      @Param("staleBefore") Instant staleBefore);
}
