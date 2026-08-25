package com.vocabflow.vocabulary.application;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

import com.vocabflow.shared.web.ConflictException;
import com.vocabflow.vocabulary.domain.*;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class VocabularyServiceTest {
  private final VocabularyItemRepository items = mock(VocabularyItemRepository.class);
  private final UserVocabularyRepository userItems = mock(UserVocabularyRepository.class);
  private final VocabularyEnrichmentProvider provider = mock(VocabularyEnrichmentProvider.class);
  private final VocabularyService service = new VocabularyService(items, userItems, provider);

  @Test
  void translatesDuplicatePersistenceResultToConflictThroughRepositoryPort() {
    VocabularyItem item =
        new VocabularyItem(
            1,
            new VocabularyTerm("overwhelmed"),
            null,
            null,
            null,
            null,
            null,
            null,
            EnrichmentStatus.PENDING,
            null,
            Instant.parse("2026-01-01T00:00:00Z"));
    when(items.findByNormalizedTerm("overwhelmed")).thenReturn(Optional.of(item));
    when(userItems.existsByUserIdAndVocabularyItemId(2L, 1L)).thenReturn(false);
    when(userItems.saveIfAbsent(any(UserVocabulary.class))).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service.add(2L, "overwhelmed"))
        .isInstanceOf(ConflictException.class)
        .hasMessage("This vocabulary is already in your list");
  }
}
