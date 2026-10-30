package com.vocabflow.vocabulary.application;

import com.vocabflow.shared.web.*;
import com.vocabflow.vocabulary.domain.*;
import java.time.Duration;
import java.time.Instant;
import org.springframework.stereotype.Service;

@Service
public class VocabularyService {
  private static final Duration STALE_PENDING_AFTER = Duration.ofMinutes(5);

  private final VocabularyItemRepository items;
  private final UserVocabularyRepository userItems;
  private final VocabularyEnrichmentProvider provider;

  public VocabularyService(
      VocabularyItemRepository items,
      UserVocabularyRepository userItems,
      VocabularyEnrichmentProvider provider) {
    this.items = items;
    this.userItems = userItems;
    this.provider = provider;
  }

  // Deliberately not @Transactional: the adapters catch duplicate-key errors from saveIfAbsent, and
  // inside one shared transaction that poisons the session and hides the winner's committed row.
  public UserVocabulary add(long userId, String rawTerm) {
    VocabularyTerm term = new VocabularyTerm(rawTerm);
    VocabularyItem item =
        completeIfStale(
            items.findByNormalizedTerm(term.normalized()).orElseGet(() -> create(term)));
    if (userItems.existsByUserIdAndVocabularyItemId(userId, item.id())) {
      throw new ConflictException("This vocabulary is already in your list");
    }
    return userItems
        .saveIfAbsent(new UserVocabulary(0, userId, item, LearningStatus.NEW, Instant.now()))
        .orElseThrow(() -> new ConflictException("This vocabulary is already in your list"));
  }

  private VocabularyItem create(VocabularyTerm term) {
    VocabularyItem pending =
        new VocabularyItem(
            0,
            term,
            null,
            null,
            null,
            null,
            null,
            null,
            EnrichmentStatus.PENDING,
            null,
            Instant.now());
    var saved = items.saveIfAbsent(pending);
    if (saved.isEmpty()) {
      return items.findByNormalizedTerm(term.normalized()).orElseThrow();
    }

    return items.save(enrich(saved.get()));
  }

  // A PENDING item older than the threshold lost its enrichment (e.g. the process stopped between
  // insert and enrich); a younger one is most likely still being enriched by a concurrent request.
  private VocabularyItem completeIfStale(VocabularyItem item) {
    boolean stale =
        item.enrichmentStatus() == EnrichmentStatus.PENDING
            && item.createdAt().isBefore(Instant.now().minus(STALE_PENDING_AFTER));
    return stale ? items.save(enrich(item)) : item;
  }

  private VocabularyItem enrich(VocabularyItem item) {
    try {
      EnrichmentResult result = provider.enrich(item.term());
      return new VocabularyItem(
          item.id(),
          item.term(),
          result.type(),
          result.phonetic(),
          result.partOfSpeech(),
          result.definition(),
          result.examples(),
          result.collocations(),
          EnrichmentStatus.COMPLETED,
          null,
          item.createdAt());
    } catch (Exception exception) {
      return new VocabularyItem(
          item.id(),
          item.term(),
          item.type(),
          item.phonetic(),
          item.partOfSpeech(),
          item.definition(),
          item.examples(),
          item.collocations(),
          EnrichmentStatus.FAILED,
          "Enrichment could not be completed",
          item.createdAt());
    }
  }

  public VocabularyPage list(long userId, int page, int size) {
    return userItems.findByUserId(userId, Math.max(page, 0), Math.min(Math.max(size, 1), 100));
  }

  public UserVocabulary detail(long userId, long id) {
    return userItems
        .findByIdAndUserId(id, userId)
        .orElseThrow(() -> new NotFoundException("Vocabulary was not found"));
  }
}
