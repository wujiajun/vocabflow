package com.vocabflow.vocabulary.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class JpaEnrichmentUsageRepositoryAdapterTest {
  private static final LocalDate DAY = LocalDate.of(2026, 11, 1);

  private final EnrichmentUsageJpaRepository usage = mock(EnrichmentUsageJpaRepository.class);
  private final JpaEnrichmentUsageRepositoryAdapter adapter =
      new JpaEnrichmentUsageRepositoryAdapter(usage);

  @Test
  void aRowCreatedJustAfterTheFirstIncrementIsNotMistakenForReachingTheLimit() {
    when(usage.increment(1L, DAY, 50)).thenReturn(0, 1);
    when(usage.findByUserIdAndUsageDate(1L, DAY))
        .thenReturn(Optional.of(new EnrichmentUsageEntity()));

    assertThat(adapter.tryConsume(1L, DAY, 50)).isTrue();
  }

  @Test
  void anExistingRowAtTheLimitIsRefused() {
    when(usage.increment(1L, DAY, 50)).thenReturn(0, 0);
    when(usage.findByUserIdAndUsageDate(1L, DAY))
        .thenReturn(Optional.of(new EnrichmentUsageEntity()));

    assertThat(adapter.tryConsume(1L, DAY, 50)).isFalse();
  }
}
