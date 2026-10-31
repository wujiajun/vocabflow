package com.vocabflow.vocabulary.application;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import com.vocabflow.vocabulary.domain.*;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class SenseBackfillTest {
  private static final EnrichmentResult RESULT =
      new EnrichmentResult(
          VocabularyType.WORD, null, "noun", "A definition.", List.of("e"), List.of());

  private final VocabularyItemRepository items = mock(VocabularyItemRepository.class);
  private final VocabularyEnrichmentProvider provider = mock(VocabularyEnrichmentProvider.class);
  private final EnrichmentScheduler scheduler = mock(EnrichmentScheduler.class);
  private final SenseBackfill backfill = new SenseBackfill(items, provider, scheduler);

  SenseBackfillTest() {
    when(provider.source()).thenReturn("claude:test");
    when(scheduler.schedule(any()))
        .thenAnswer(
            call -> {
              call.<Runnable>getArgument(0).run();
              return true;
            });
    when(items.findById(anyLong())).thenAnswer(call -> Optional.of(item(call.getArgument(0))));
  }

  @Test
  void updatesEveryWordWithoutMeaningsInTheBackground() {
    when(items.findCompletedIdsWithoutSenses()).thenReturn(List.of(1L, 2L));
    when(provider.enrich(any())).thenReturn(RESULT);

    backfill.start();

    verify(scheduler).schedule(any());
    verify(items).markCompleted(eq(1L), eq(RESULT), eq("claude:test"), any(Instant.class));
    verify(items).markCompleted(eq(2L), eq(RESULT), eq("claude:test"), any(Instant.class));
  }

  @Test
  void aFailedWordKeepsItsContentAndDoesNotStopTheOthers() {
    when(items.findCompletedIdsWithoutSenses()).thenReturn(List.of(1L, 2L));
    when(provider.enrich(any()))
        .thenThrow(new EnrichmentRejectedException("Model reply describes a different term"))
        .thenReturn(RESULT);

    backfill.start();

    verify(items, never()).markCompleted(eq(1L), any(), any(), any());
    verify(items, never()).markFailed(anyLong(), any());
    verify(items).markCompleted(eq(2L), eq(RESULT), any(), any());
  }

  @Test
  void doesNothingWithPlaceholderContentOrWithNothingToUpdate() {
    when(provider.source()).thenReturn("fake");
    backfill.start();
    verifyNoInteractions(scheduler);
    verify(items, never()).findCompletedIdsWithoutSenses();

    when(provider.source()).thenReturn("claude:test");
    when(items.findCompletedIdsWithoutSenses()).thenReturn(List.of());
    backfill.start();
    verifyNoInteractions(scheduler);
  }

  private static VocabularyItem item(long id) {
    return new VocabularyItem(
        id,
        new VocabularyTerm("word " + id),
        null,
        null,
        null,
        "old",
        List.of(),
        List.of(),
        EnrichmentStatus.COMPLETED,
        null,
        Instant.parse("2026-01-01T00:00:00Z"));
  }
}
