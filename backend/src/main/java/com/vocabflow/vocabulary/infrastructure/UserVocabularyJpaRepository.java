package com.vocabflow.vocabulary.infrastructure;

import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;

public interface UserVocabularyJpaRepository extends JpaRepository<UserVocabularyEntity, Long> {
  boolean existsByUserIdAndItem_Id(Long uid, Long item);

  Page<UserVocabularyEntity> findByUserIdOrderByCreatedAtDesc(Long uid, Pageable p);

  List<UserVocabularyEntity> findByUserIdAndLearningStatusOrderByCreatedAtAscIdAsc(
      Long userId, String learningStatus, Pageable pageable);

  Optional<UserVocabularyEntity> findByIdAndUserId(Long id, Long userId);

  List<UserVocabularyEntity> findByUserIdAndIdIn(Long userId, Collection<Long> ids);
}
