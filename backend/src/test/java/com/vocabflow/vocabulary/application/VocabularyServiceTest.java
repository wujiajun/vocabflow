package com.vocabflow.vocabulary.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.vocabflow.shared.web.ConflictException;
import com.vocabflow.vocabulary.domain.*;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class VocabularyServiceTest {
  private final VocabularyItemRepository items = mock(VocabularyItemRepository.class);
  private final UserVocabularyRepository userItems = mock(UserVocabularyRepository.class);
  private final VocabularyEnrichmentProvider provider = mock(VocabularyEnrichmentProvider.class);
  private final VocabularyService service = new VocabularyService(items, userItems, provider);

  @Test
  void translatesDuplicatePersistenceResultToConflictThroughRepositoryPort() {
    VocabularyItem item = item(EnrichmentStatus.COMPLETED, Instant.parse("2026-01-01T00:00:00Z"));
    when(items.findByNormalizedTerm("overwhelmed")).thenReturn(Optional.of(item));
    when(userItems.existsByUserIdAndVocabularyItemId(2L, 1L)).thenReturn(false);
    when(userItems.saveIfAbsent(any(UserVocabulary.class))).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service.add(2L, "overwhelmed"))
        .isInstanceOf(ConflictException.class)
        .hasMessage("This vocabulary is already in your list");
  }

  @Test
  void completesStalePendingItemBeforeAddingItToTheUser() {
    VocabularyItem stale = item(EnrichmentStatus.PENDING, Instant.now().minus(Duration.ofHours(1)));
    when(items.findByNormalizedTerm("overwhelmed")).thenReturn(Optional.of(stale));
    when(provider.enrich(stale.term()))
        .thenReturn(
            new EnrichmentResult(
                VocabularyType.WORD,
                "/phonetic/",
                "adjective",
                "a definition",
                List.of("an example"),
                List.of("a collocation")));
    when(items.save(any(VocabularyItem.class))).thenAnswer(call -> call.getArgument(0));
    when(userItems.saveIfAbsent(any(UserVocabulary.class)))
        .thenAnswer(call -> Optional.of(call.getArgument(0)));

    UserVocabulary added = service.add(2L, "overwhelmed");

    ArgumentCaptor<VocabularyItem> saved = ArgumentCaptor.forClass(VocabularyItem.class);
    verify(items).save(saved.capture());
    assertThat(saved.getValue().id()).isEqualTo(stale.id());
    assertThat(saved.getValue().enrichmentStatus()).isEqualTo(EnrichmentStatus.COMPLETED);
    assertThat(saved.getValue().definition()).isEqualTo("a definition");
    assertThat(saved.getValue().createdAt()).isEqualTo(stale.createdAt());
    assertThat(added.item().enrichmentStatus()).isEqualTo(EnrichmentStatus.COMPLETED);
  }

  @Test
  void completesStalePendingItemEvenWhenTheUserAlreadyHasIt() {
    VocabularyItem stale = item(EnrichmentStatus.PENDING, Instant.now().minus(Duration.ofHours(1)));
    when(items.findByNormalizedTerm("overwhelmed")).thenReturn(Optional.of(stale));
    when(provider.enrich(stale.term()))
        .thenReturn(
            new EnrichmentResult(VocabularyType.WORD, null, null, "a definition", null, null));
    when(items.save(any(VocabularyItem.class))).thenAnswer(call -> call.getArgument(0));
    when(userItems.existsByUserIdAndVocabularyItemId(2L, 1L)).thenReturn(true);

    assertThatThrownBy(() -> service.add(2L, "overwhelmed")).isInstanceOf(ConflictException.class);

    ArgumentCaptor<VocabularyItem> saved = ArgumentCaptor.forClass(VocabularyItem.class);
    verify(items).save(saved.capture());
    assertThat(saved.getValue().enrichmentStatus()).isEqualTo(EnrichmentStatus.COMPLETED);
  }

  @Test
  void leavesRecentPendingItemAloneBecauseAnotherRequestIsLikelyEnrichingIt() {
    VocabularyItem recent =
        item(EnrichmentStatus.PENDING, Instant.now().minus(Duration.ofSeconds(30)));
    when(items.findByNormalizedTerm("overwhelmed")).thenReturn(Optional.of(recent));
    when(userItems.saveIfAbsent(any(UserVocabulary.class)))
        .thenAnswer(call -> Optional.of(call.getArgument(0)));

    UserVocabulary added = service.add(2L, "overwhelmed");

    verifyNoInteractions(provider);
    verify(items, never()).save(any(VocabularyItem.class));
    assertThat(added.item().enrichmentStatus()).isEqualTo(EnrichmentStatus.PENDING);
  }

  @Test
  void leavesCompletedAndFailedItemsAlone() {
    for (EnrichmentStatus status : List.of(EnrichmentStatus.COMPLETED, EnrichmentStatus.FAILED)) {
      VocabularyItem old = item(status, Instant.now().minus(Duration.ofDays(1)));
      when(items.findByNormalizedTerm("overwhelmed")).thenReturn(Optional.of(old));
      when(userItems.saveIfAbsent(any(UserVocabulary.class)))
          .thenAnswer(call -> Optional.of(call.getArgument(0)));

      service.add(2L, "overwhelmed");
    }

    verifyNoInteractions(provider);
    verify(items, never()).save(any(VocabularyItem.class));
  }

  @Test
  void marksStalePendingItemFailedWhenEnrichmentFailsAgainAndStillAddsIt() {
    VocabularyItem stale = item(EnrichmentStatus.PENDING, Instant.now().minus(Duration.ofHours(1)));
    when(items.findByNormalizedTerm("overwhelmed")).thenReturn(Optional.of(stale));
    when(provider.enrich(stale.term())).thenThrow(new IllegalStateException("provider down"));
    when(items.save(any(VocabularyItem.class))).thenAnswer(call -> call.getArgument(0));
    when(userItems.saveIfAbsent(any(UserVocabulary.class)))
        .thenAnswer(call -> Optional.of(call.getArgument(0)));

    UserVocabulary added = service.add(2L, "overwhelmed");

    assertThat(added.item().enrichmentStatus()).isEqualTo(EnrichmentStatus.FAILED);
    assertThat(added.item().failureReason()).isEqualTo("Enrichment could not be completed");
  }

  private static VocabularyItem item(EnrichmentStatus status, Instant createdAt) {
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
        createdAt);
  }
}
