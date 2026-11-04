package com.vocabflow.vocabulary.application;

import com.vocabflow.vocabulary.domain.EnrichmentResult;
import com.vocabflow.vocabulary.domain.EnrichmentStatus;
import com.vocabflow.vocabulary.domain.VocabularyItem;
import java.time.Instant;
import java.util.List;
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

  /**
   * Completes an item whose text only inflects {@code result.baseForm()}, so that it becomes that
   * word instead, in one transaction: the item is renamed when no item of that word exists, and
   * otherwise every user's entry moves to the existing completed one and this item is deleted.
   * Returns false, having changed nothing, when it cannot be done safely: a user has already
   * studied it or holds the base word, or the base item is not completed. The caller then completes
   * it as typed.
   */
  boolean completeAsBaseForm(long id, EnrichmentResult result, String source, Instant at);

  void markFailed(long id, String reason);

  /** Fails the item because the text is a misspelling of {@code suggestion}. */
  void markMisspelled(long id, String suggestion, String reason);

  List<Long> findCompletedIdsWithoutSenses();

  /** Removes the shared item unless some user's entry still refers to it. */
  void deleteIfUnused(long id);
}
