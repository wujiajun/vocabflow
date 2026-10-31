package com.vocabflow.vocabulary.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import com.vocabflow.vocabulary.domain.*;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;

@ExtendWith(OutputCaptureExtension.class)
class VocabularyEnrichmentServiceTest {
  private static final EnrichmentResult RESULT =
      new EnrichmentResult(
          VocabularyType.WORD, "/x/", "noun", "a definition", List.of("an example"), List.of());

  private final VocabularyItemRepository items = mock(VocabularyItemRepository.class);
  private final EnrichmentUsageRepository usage = mock(EnrichmentUsageRepository.class);
  private final VocabularyEnrichmentProvider provider = mock(VocabularyEnrichmentProvider.class);
  private final VocabularyEnrichmentService service =
      new VocabularyEnrichmentService(items, usage, provider, 50);

  VocabularyEnrichmentServiceTest() {
    when(provider.source()).thenReturn("test-model");
    when(usage.tryConsume(anyLong(), any(), anyInt())).thenReturn(true);
    when(items.findById(1L)).thenReturn(Optional.of(item()));
  }

  @Test
  void claimsThenEnrichesAndRecordsTheSource() {
    claimWins(true);
    when(provider.enrich(any())).thenReturn(RESULT);

    service.claimAndEnrich(1L, 2L, Set.of(EnrichmentStatus.PENDING));

    verify(items).markCompleted(eq(1L), eq(RESULT), eq("test-model"), any(Instant.class));
    verify(items, never()).markFailed(anyLong(), any());
  }

  @Test
  void doesNotCallTheProviderOrChargeTheUserWhenAnotherRequestWonTheClaim() {
    claimWins(false);

    service.claimAndEnrich(1L, 2L, Set.of(EnrichmentStatus.PENDING));

    verifyNoInteractions(provider, usage);
    verify(items, never()).markCompleted(anyLong(), any(), any(), any());
    verify(items, never()).markFailed(anyLong(), any());
  }

  @Test
  void claimsOnlyTheStatusesTheCallerAllowsAndTreatsOldProcessingAsLost() {
    claimWins(false);

    service.claimAndEnrich(1L, 2L, Set.of(EnrichmentStatus.FAILED));

    ArgumentCaptor<Instant> now = ArgumentCaptor.forClass(Instant.class);
    ArgumentCaptor<Instant> staleBefore = ArgumentCaptor.forClass(Instant.class);
    verify(items)
        .claimForEnrichment(
            eq(1L), eq(Set.of(EnrichmentStatus.FAILED)), now.capture(), staleBefore.capture());
    assertThat(java.time.Duration.between(staleBefore.getValue(), now.getValue()))
        .isEqualTo(VocabularyEnrichmentService.PROCESSING_LOST_AFTER);
  }

  @Test
  void marksTheItemFailedWithoutLeakingTheProviderMessage() {
    when(provider.enrich(any())).thenThrow(new IllegalStateException("secret-looking detail"));

    service.enrich(1L, 2L);

    verify(items).markFailed(1L, "Enrichment could not be completed");
  }

  @Test
  void logsWhyAReplyWasRejectedButNotOtherProviderMessages(CapturedOutput output) {
    when(provider.enrich(any())).thenThrow(new EnrichmentRejectedException("Model reply is bad"));
    service.enrich(1L, 2L);
    doThrow(new IllegalStateException("secret-looking detail")).when(provider).enrich(any());
    service.enrich(1L, 2L);

    assertThat(output).contains("Model reply is bad").doesNotContain("secret-looking detail");
    verify(items, times(2)).markFailed(1L, "Enrichment could not be completed");
  }

  @Test
  void marksTheItemFailedAndSkipsTheProviderWhenTheDailyLimitIsReached() {
    when(usage.tryConsume(eq(2L), any(), eq(50))).thenReturn(false);

    service.enrich(1L, 2L);

    verifyNoInteractions(provider);
    verify(items).markFailed(1L, "Daily enrichment limit reached");
  }

  @Test
  void anUnexpectedErrorWhileClaimingDoesNotEscapeTheBackgroundTask() {
    when(items.claimForEnrichment(anyLong(), any(), any(), any()))
        .thenThrow(new IllegalStateException("database down"));

    service.claimAndEnrich(1L, 2L, Set.of(EnrichmentStatus.PENDING));

    verifyNoInteractions(provider);
  }

  private void claimWins(boolean wins) {
    when(items.claimForEnrichment(anyLong(), any(), any(), any())).thenReturn(wins);
  }

  private static VocabularyItem item() {
    return new VocabularyItem(
        1,
        new VocabularyTerm("overwhelmed"),
        null,
        null,
        null,
        null,
        null,
        null,
        EnrichmentStatus.PROCESSING,
        null,
        Instant.parse("2026-01-01T00:00:00Z"));
  }
}
