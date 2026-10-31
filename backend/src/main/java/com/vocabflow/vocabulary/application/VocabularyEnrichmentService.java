package com.vocabflow.vocabulary.application;

import com.vocabflow.vocabulary.domain.*;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Fills a shared vocabulary item with provider content. Deliberately not transactional: every
 * repository call is its own short transaction, so a slow provider call never holds a connection.
 */
@Service
public class VocabularyEnrichmentService {
  private static final Logger log = LoggerFactory.getLogger(VocabularyEnrichmentService.class);

  // A PROCESSING item older than this lost its worker (e.g. the process stopped) and may be claimed
  // again. Must stay well above the provider timeout.
  static final Duration PROCESSING_LOST_AFTER = Duration.ofMinutes(5);
  static final String FAILED_REASON = "Enrichment could not be completed";
  static final String LIMIT_REASON = "Daily enrichment limit reached";

  private final VocabularyItemRepository items;
  private final EnrichmentUsageRepository usage;
  private final VocabularyEnrichmentProvider provider;
  private final int dailyLimit;

  public VocabularyEnrichmentService(
      VocabularyItemRepository items,
      EnrichmentUsageRepository usage,
      VocabularyEnrichmentProvider provider,
      @Value("${vocabflow.enrichment.daily-limit:50}") int dailyLimit) {
    this.items = items;
    this.usage = usage;
    this.provider = provider;
    this.dailyLimit = dailyLimit;
  }

  public boolean hasQuota(long userId) {
    return usage.hasRemaining(userId, today(), dailyLimit);
  }

  /** Claims the item and, if this caller won the claim, enriches it. */
  public void claimAndEnrich(long itemId, long userId, Set<EnrichmentStatus> claimable) {
    try {
      if (claim(itemId, claimable)) {
        enrich(itemId, userId);
      }
    } catch (RuntimeException exception) {
      log.error("Enrichment of item {} aborted: {}", itemId, exception.getClass().getSimpleName());
    }
  }

  public boolean claim(long itemId, Set<EnrichmentStatus> claimable) {
    Instant now = Instant.now();
    return items.claimForEnrichment(itemId, claimable, now, now.minus(PROCESSING_LOST_AFTER));
  }

  /** Runs the provider for an item this caller has claimed, charging the user's daily quota. */
  public void enrich(long itemId, long userId) {
    try {
      if (!usage.tryConsume(userId, today(), dailyLimit)) {
        items.markFailed(itemId, LIMIT_REASON);
        return;
      }
      VocabularyItem item = items.findById(itemId).orElseThrow();
      EnrichmentResult result = provider.enrich(item.term());
      items.markCompleted(itemId, result, provider.source(), Instant.now());
    } catch (EnrichmentRejectedException exception) {
      log.warn("Enrichment of item {} rejected: {}", itemId, exception.getMessage());
      items.markFailed(itemId, FAILED_REASON);
    } catch (RuntimeException exception) {
      // The class name only: provider messages can echo request details.
      log.warn("Enrichment of item {} failed: {}", itemId, exception.getClass().getSimpleName());
      items.markFailed(itemId, FAILED_REASON);
    }
  }

  private static LocalDate today() {
    return LocalDate.now(ZoneOffset.UTC);
  }
}
