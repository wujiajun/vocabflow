package com.vocabflow.vocabulary.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

import com.vocabflow.shared.web.ConflictException;
import com.vocabflow.shared.web.NotFoundException;
import com.vocabflow.shared.web.TooManyRequestsException;
import com.vocabflow.vocabulary.domain.*;
import java.time.Instant;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class VocabularyServiceTest {
  private final VocabularyItemRepository items = mock(VocabularyItemRepository.class);
  private final UserVocabularyRepository userItems = mock(UserVocabularyRepository.class);
  private final VocabularyEnrichmentService enrichment = mock(VocabularyEnrichmentService.class);
  private final EnrichmentScheduler scheduler = mock(EnrichmentScheduler.class);
  private final VocabularyService service =
      new VocabularyService(items, userItems, enrichment, scheduler);

  @Test
  void translatesDuplicatePersistenceResultToConflictThroughRepositoryPort() {
    VocabularyItem item = item(EnrichmentStatus.COMPLETED);
    when(items.findByNormalizedTerm("overwhelmed")).thenReturn(Optional.of(item));
    when(userItems.existsByUserIdAndVocabularyItemId(2L, 1L)).thenReturn(false);
    when(userItems.saveIfAbsent(any(UserVocabulary.class))).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service.add(2L, "overwhelmed"))
        .isInstanceOf(ConflictException.class)
        .hasMessage("This vocabulary is already in your list");
  }

  @Test
  void addingANewTermSavesItPendingAndSchedulesEnrichmentWithoutWaitingForIt() {
    VocabularyItem saved = item(EnrichmentStatus.PENDING);
    when(items.findByNormalizedTerm("overwhelmed")).thenReturn(Optional.empty());
    when(items.saveIfAbsent(any(VocabularyItem.class))).thenReturn(Optional.of(saved));
    when(userItems.saveIfAbsent(any(UserVocabulary.class)))
        .thenAnswer(call -> Optional.of(call.getArgument(0)));

    UserVocabulary added = service.add(2L, "overwhelmed");

    assertThat(added.item().enrichmentStatus()).isEqualTo(EnrichmentStatus.PENDING);
    ArgumentCaptor<Runnable> task = ArgumentCaptor.forClass(Runnable.class);
    verify(scheduler).schedule(task.capture());
    verifyNoInteractions(enrichment);
    task.getValue().run();
    verify(enrichment).claimAndEnrich(1L, 2L, Set.of(EnrichmentStatus.PENDING));
  }

  @Test
  void schedulesUnfinishedItemsSoAStrandedOneIsRepairedEvenIfTheUserAlreadyHasIt() {
    for (EnrichmentStatus status : Set.of(EnrichmentStatus.PENDING, EnrichmentStatus.PROCESSING)) {
      when(items.findByNormalizedTerm("overwhelmed")).thenReturn(Optional.of(item(status)));
      when(userItems.existsByUserIdAndVocabularyItemId(2L, 1L)).thenReturn(true);

      assertThatThrownBy(() -> service.add(2L, "overwhelmed"))
          .isInstanceOf(ConflictException.class);
    }

    verify(scheduler, times(2)).schedule(any(Runnable.class));
  }

  @Test
  void leavesCompletedAndFailedItemsAlone() {
    for (EnrichmentStatus status : Set.of(EnrichmentStatus.COMPLETED, EnrichmentStatus.FAILED)) {
      when(items.findByNormalizedTerm("overwhelmed")).thenReturn(Optional.of(item(status)));
      when(userItems.saveIfAbsent(any(UserVocabulary.class)))
          .thenAnswer(call -> Optional.of(call.getArgument(0)));

      service.add(2L, "overwhelmed");
    }

    verifyNoInteractions(scheduler, enrichment);
  }

  @Test
  void retryClaimsTheFailedItemAndSchedulesIt() {
    ownedItem(EnrichmentStatus.FAILED);
    when(enrichment.hasQuota(2L)).thenReturn(true);
    when(enrichment.claim(1L, Set.of(EnrichmentStatus.FAILED))).thenReturn(true);
    when(scheduler.schedule(any(Runnable.class))).thenReturn(true);

    service.retryEnrichment(2L, 7L);

    ArgumentCaptor<Runnable> task = ArgumentCaptor.forClass(Runnable.class);
    verify(scheduler).schedule(task.capture());
    task.getValue().run();
    verify(enrichment).enrich(1L, 2L);
  }

  @Test
  void retryDoesNothingWhenAnotherRequestAlreadyClaimedTheItem() {
    ownedItem(EnrichmentStatus.FAILED);
    when(enrichment.hasQuota(2L)).thenReturn(true);
    when(enrichment.claim(anyLong(), any())).thenReturn(false);

    service.retryEnrichment(2L, 7L);

    verifyNoInteractions(scheduler);
  }

  @Test
  void retryMarksTheItemFailedAgainWhenTheQueueIsFull() {
    ownedItem(EnrichmentStatus.FAILED);
    when(enrichment.hasQuota(2L)).thenReturn(true);
    when(enrichment.claim(anyLong(), any())).thenReturn(true);
    when(scheduler.schedule(any(Runnable.class))).thenReturn(false);

    service.retryEnrichment(2L, 7L);

    verify(items).markFailed(eq(1L), any());
  }

  @Test
  void retryRefusesItemsThatAreNotFailed() {
    for (EnrichmentStatus status :
        Set.of(EnrichmentStatus.PENDING, EnrichmentStatus.PROCESSING, EnrichmentStatus.COMPLETED)) {
      ownedItem(status);

      assertThatThrownBy(() -> service.retryEnrichment(2L, 7L))
          .isInstanceOf(ConflictException.class);
    }

    verifyNoInteractions(scheduler);
  }

  @Test
  void retryIsRefusedOnceTheDailyLimitIsReached() {
    ownedItem(EnrichmentStatus.FAILED);
    when(enrichment.hasQuota(2L)).thenReturn(false);

    assertThatThrownBy(() -> service.retryEnrichment(2L, 7L))
        .isInstanceOf(TooManyRequestsException.class);

    verify(enrichment, never()).claim(anyLong(), any());
  }

  @Test
  void retryOfSomeoneElsesVocabularyIsNotFound() {
    when(userItems.findByIdAndUserId(7L, 2L)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service.retryEnrichment(2L, 7L)).isInstanceOf(NotFoundException.class);
  }

  private void ownedItem(EnrichmentStatus status) {
    when(userItems.findByIdAndUserId(7L, 2L))
        .thenReturn(
            Optional.of(new UserVocabulary(7, 2, item(status), LearningStatus.NEW, Instant.now())));
  }

  private static VocabularyItem item(EnrichmentStatus status) {
    return new VocabularyItem(
        1,
        new VocabularyTerm("overwhelmed"),
        null,
        null,
        null,
        null,
        null,
        null,
        status,
        null,
        Instant.parse("2026-01-01T00:00:00Z"));
  }
}
