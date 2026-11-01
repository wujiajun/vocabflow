package com.vocabflow.vocabulary.application;

import com.vocabflow.shared.web.*;
import com.vocabflow.vocabulary.domain.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class VocabularyService {
  private final VocabularyItemRepository items;
  private final UserVocabularyRepository userItems;
  private final VocabularyEnrichmentService enrichment;
  private final EnrichmentScheduler scheduler;
  private final DueVocabularyQuery due;
  private final StudyRecords studyRecords;

  public VocabularyService(
      VocabularyItemRepository items,
      UserVocabularyRepository userItems,
      VocabularyEnrichmentService enrichment,
      EnrichmentScheduler scheduler,
      DueVocabularyQuery due,
      StudyRecords studyRecords) {
    this.items = items;
    this.userItems = userItems;
    this.enrichment = enrichment;
    this.scheduler = scheduler;
    this.due = due;
    this.studyRecords = studyRecords;
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
    if (owned.item().spellingSuggestion() != null) {
      throw new ConflictException("This word looks misspelled; add the correct spelling instead");
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

  /**
   * Removes a word whose enrichment failed, along with its place in any stored daily plan. A word
   * that finished, or that the user has already rated, stays. The shared item goes too once no
   * one's entry refers to it, so adding the same text again starts afresh.
   */
  @Transactional
  public void remove(long userId, long id) {
    UserVocabulary owned = detail(userId, id);
    if (owned.item().enrichmentStatus() != EnrichmentStatus.FAILED) {
      throw new ConflictException("Only a failed word can be removed");
    }
    if (studyRecords.hasHistory(userId, id)) {
      throw new ConflictException("A word you have studied cannot be removed");
    }
    studyRecords.removeFromPlans(userId, id);
    if (!userItems.delete(id, userId)) {
      // A plan was extended with it at the same moment; the whole removal is rolled back.
      throw new ConflictException("That word is in use right now; try again");
    }
    if (!userItems.existsByVocabularyItemId(owned.item().id())) {
      items.deleteIfUnused(owned.item().id());
    }
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
