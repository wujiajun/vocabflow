package com.vocabflow.vocabulary.application;

import com.vocabflow.vocabulary.domain.VocabularyItem;
import java.util.Optional;

public interface VocabularyItemRepository {
  Optional<VocabularyItem> findByNormalizedTerm(String normalizedTerm);

  Optional<VocabularyItem> saveIfAbsent(VocabularyItem item);

  VocabularyItem save(VocabularyItem item);
}
