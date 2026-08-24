package com.vocabflow.vocabulary.infrastructure;

import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VocabularyItemJpaRepository extends JpaRepository<VocabularyItemEntity, Long> {
  Optional<VocabularyItemEntity> findByNormalizedTerm(String s);
}
