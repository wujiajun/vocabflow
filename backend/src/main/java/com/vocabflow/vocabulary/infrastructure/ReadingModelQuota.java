package com.vocabflow.vocabulary.infrastructure;

import com.vocabflow.reading.application.ModelQuota;
import com.vocabflow.vocabulary.application.EnrichmentUsageRepository;
import java.time.LocalDate;
import java.time.ZoneOffset;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Passages draw on the same daily allowance of model calls as word details. */
@Component
public class ReadingModelQuota implements ModelQuota {
  private final EnrichmentUsageRepository usage;
  private final int dailyLimit;

  public ReadingModelQuota(
      EnrichmentUsageRepository usage,
      @Value("${vocabflow.enrichment.daily-limit:50}") int dailyLimit) {
    this.usage = usage;
    this.dailyLimit = dailyLimit;
  }

  @Override
  public boolean tryConsume(long userId) {
    return usage.tryConsume(userId, LocalDate.now(ZoneOffset.UTC), dailyLimit);
  }
}
