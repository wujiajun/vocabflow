package com.vocabflow.vocabulary.application;

import com.vocabflow.shared.web.*;
import com.vocabflow.vocabulary.domain.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class VocabularyService {
  private final VocabularyItemRepository items;
  private final UserVocabularyRepository userItems;
  private final VocabularyEnrichmentService enrichment;
  private final EnrichmentScheduler scheduler;
  private final DueVocabularyQuery due;

  public VocabularyService(
      VocabularyItemRepository items,
      UserVocabularyRepository userItems,
      VocabularyEnrichmentService enrichment,
      EnrichmentScheduler scheduler,
      DueVocabularyQuery due) {
    this.items = items;
    this.userItems = userItems;
    this.enrichment = enrichment;
    this.scheduler = scheduler;
    this.due = due;
  }

  // Deliberately not @Transactional: the adapters catch duplicate-key errors from saveIfAbsent, and
  // inside one shared transaction that poisons the session and hides the winner's committed row.
  // Enrichment runs in the background, so the returned item is as it was when it was saved.
  public UserVocabulary add(long userId, String rawTerm) {
    VocabularyTerm term = new VocabularyTerm(rawTerm);
    VocabularyItem item =
        items.findByNormalizedTerm(term.normalized()).orElseGet(() -> create(term));
    scheduleIfUnfinished(item, userId);
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
    return items
        .saveIfAbsent(pending)
        .orElseGet(() -> items.findByNormalizedTerm(term.normalized()).orElseThrow());
  }

  // PENDING is new or stranded, PROCESSING may be a lost worker; the claim decides who proceeds, so
  // scheduling for an item that another request is already enriching is harmless.
  private void scheduleIfUnfinished(VocabularyItem item, long userId) {
    if (item.enrichmentStatus() == EnrichmentStatus.PENDING
        || item.enrichmentStatus() == EnrichmentStatus.PROCESSING) {
      scheduler.schedule(
          () -> enrichment.claimAndEnrich(item.id(), userId, Set.of(EnrichmentStatus.PENDING)));
    }
  }

  public UserVocabulary retryEnrichment(long userId, long id) {
    UserVocabulary owned = detail(userId, id);
    long itemId = owned.item().id();
    if (owned.item().enrichmentStatus() != EnrichmentStatus.FAILED) {
      throw new ConflictException("Only failed enrichment can be retried");
    }
    if (!enrichment.hasQuota(userId)) {
      throw new TooManyRequestsException("Daily enrichment limit reached");
    }
    if (enrichment.claim(itemId, Set.of(EnrichmentStatus.FAILED))
        && !scheduler.schedule(() -> enrichment.enrich(itemId, userId))) {
      items.markFailed(itemId, "Enrichment is busy; try again shortly");
    }
    return detail(userId, id);
  }

  public VocabularyPage list(long userId, int page, int size) {
    return list(userId, page, size, null, null);
  }

  /** {@code dueOn} keeps only words to study by that day; {@code status} keeps only that status. */
  public VocabularyPage list(
      long userId, int page, int size, LearningStatus status, LocalDate dueOn) {
    int safePage = Math.max(page, 0);
    int safeSize = Math.min(Math.max(size, 1), 100);
    if (status == null && dueOn == null) {
      return userItems.findByUserId(userId, safePage, safeSize);
    }
    return userItems.findFiltered(
        userId, status, dueOn == null ? null : due.findDueIds(userId, dueOn), safePage, safeSize);
  }

  public UserVocabulary detail(long userId, long id) {
    return userItems
        .findByIdAndUserId(id, userId)
        .orElseThrow(() -> new NotFoundException("Vocabulary was not found"));
  }
}
