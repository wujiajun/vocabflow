package com.vocabflow.vocabulary.infrastructure;

import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface UserVocabularyJpaRepository extends JpaRepository<UserVocabularyEntity, Long> {
  boolean existsByUserIdAndItem_Id(Long uid, Long item);

  Page<UserVocabularyEntity> findByUserIdOrderByCreatedAtDesc(Long uid, Pageable p);

  List<UserVocabularyEntity>
      findByUserIdAndLearningStatusAndItem_EnrichmentStatusOrderByCreatedAtAscIdAsc(
          Long userId, String learningStatus, String enrichmentStatus, Pageable pageable);

  @Query(
      """
      select u from UserVocabularyEntity u
       where u.userId = :userId
         and (:status is null or u.learningStatus = :status)
         and (:anyId = true or u.id in :ids)
         and (:anySearch = true
              or lower(u.item.term) like :pattern escape '!'
              or u.item.normalizedTerm like :pattern escape '!')
       order by u.createdAt desc, u.id desc
      """)
  Page<UserVocabularyEntity> findFiltered(
      @Param("userId") Long userId,
      @Param("status") String status,
      @Param("anyId") boolean anyId,
      @Param("ids") Collection<Long> ids,
      @Param("anySearch") boolean anySearch,
      @Param("pattern") String pattern,
      Pageable pageable);

  Optional<UserVocabularyEntity> findByIdAndUserId(Long id, Long userId);

  int countByUserIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(
      Long userId, java.time.Instant from, java.time.Instant to);

  int countByUserIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanAndSourceLinkStartingWith(
      Long userId, java.time.Instant from, java.time.Instant to, String prefix);

  boolean existsByItem_Id(Long itemId);

  List<UserVocabularyEntity> findByItem_Id(Long itemId);

  @Modifying(flushAutomatically = true, clearAutomatically = true)
  @Query("delete from UserVocabularyEntity u where u.id = :id and u.userId = :userId")
  int deleteOwned(@Param("id") long id, @Param("userId") long userId);

  List<UserVocabularyEntity> findByUserIdAndIdIn(Long userId, Collection<Long> ids);
}
