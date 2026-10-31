package com.vocabflow.vocabulary.infrastructure;

import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface UserVocabularyJpaRepository extends JpaRepository<UserVocabularyEntity, Long> {
  boolean existsByUserIdAndItem_Id(Long uid, Long item);

  Page<UserVocabularyEntity> findByUserIdOrderByCreatedAtDesc(Long uid, Pageable p);

  List<UserVocabularyEntity> findByUserIdAndLearningStatusOrderByCreatedAtAscIdAsc(
      Long userId, String learningStatus, Pageable pageable);

  @Query(
      """
      select u from UserVocabularyEntity u
       where u.userId = :userId
         and (:status is null or u.learningStatus = :status)
         and (:anyId = true or u.id in :ids)
       order by u.createdAt desc, u.id desc
      """)
  Page<UserVocabularyEntity> findFiltered(
      @Param("userId") Long userId,
      @Param("status") String status,
      @Param("anyId") boolean anyId,
      @Param("ids") Collection<Long> ids,
      Pageable pageable);

  Optional<UserVocabularyEntity> findByIdAndUserId(Long id, Long userId);

  List<UserVocabularyEntity> findByUserIdAndIdIn(Long userId, Collection<Long> ids);
}
