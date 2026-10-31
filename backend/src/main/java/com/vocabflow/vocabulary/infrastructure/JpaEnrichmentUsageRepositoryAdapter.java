package com.vocabflow.vocabulary.infrastructure;

import com.vocabflow.vocabulary.application.EnrichmentUsageRepository;
import java.time.LocalDate;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Repository;

// Not transactional on purpose: when two first calls of the day race, the loser's insert hits the
// unique key; running it in its own transaction keeps that failure from poisoning a caller's.
@Repository
public class JpaEnrichmentUsageRepositoryAdapter implements EnrichmentUsageRepository {
  private final EnrichmentUsageJpaRepository usage;

  public JpaEnrichmentUsageRepositoryAdapter(EnrichmentUsageJpaRepository usage) {
    this.usage = usage;
  }

  @Override
  public boolean tryConsume(long userId, LocalDate day, int limit) {
    if (limit <= 0) {
      return false;
    }
    if (usage.increment(userId, day, limit) == 1) {
      return true;
    }
    if (usage.findByUserIdAndUsageDate(userId, day).isPresent()) {
      return false; // row exists, so the increment failed only because the limit is reached
    }
    EnrichmentUsageEntity first = new EnrichmentUsageEntity();
    first.userId = userId;
    first.usageDate = day;
    first.requestCount = 1;
    try {
      usage.saveAndFlush(first);
      return true;
    } catch (DataIntegrityViolationException raced) {
      return usage.increment(userId, day, limit) == 1;
    }
  }

  @Override
  public boolean hasRemaining(long userId, LocalDate day, int limit) {
    return usage
        .findByUserIdAndUsageDate(userId, day)
        .map(row -> row.requestCount < limit)
        .orElse(limit > 0);
  }
}
