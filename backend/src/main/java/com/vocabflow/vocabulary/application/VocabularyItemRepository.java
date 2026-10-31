package com.vocabflow.vocabulary.application;

import com.vocabflow.vocabulary.domain.EnrichmentResult;
import com.vocabflow.vocabulary.domain.EnrichmentStatus;
import com.vocabflow.vocabulary.domain.VocabularyItem;
import java.time.Instant;
import java.util.Optional;
import java.util.Set;

public interface VocabularyItemRepository {
  Optional<VocabularyItem> findById(long id);

  Optional<VocabularyItem> findByNormalizedTerm(String normalizedTerm);

  Optional<VocabularyItem> saveIfAbsent(VocabularyItem item);

  VocabularyItem save(VocabularyItem item);

  /**
   * Atomically moves the item to PROCESSING when it is in one of {@code claimable}, or is already
   * PROCESSING but started before {@code staleBefore} (its worker is presumed lost). Only the
   * caller that gets {@code true} may call the enrichment provider.
   */
  boolean claimForEnrichment(
      long id, Set<EnrichmentStatus> claimable, Instant now, Instant staleBefore);

  void markCompleted(long id, EnrichmentResult result, String source, Instant at);

  void markFailed(long id, String reason);
}
