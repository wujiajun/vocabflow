package com.vocabflow.vocabulary.application;

import com.vocabflow.vocabulary.domain.VocabularyItem;
import java.time.Instant;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

/**
 * Gives words enriched before meanings existed their full list of meanings, once, in the
 * background. Only the shared content changes, so study progress is untouched. It is not charged to
 * any user. A word that fails keeps its old content and is tried again at the next start.
 */
@Service
public class SenseBackfill {
  private static final Logger log = LoggerFactory.getLogger(SenseBackfill.class);

  private final VocabularyItemRepository items;
  private final VocabularyEnrichmentProvider provider;
  private final EnrichmentScheduler scheduler;

  public SenseBackfill(
      VocabularyItemRepository items,
      VocabularyEnrichmentProvider provider,
      EnrichmentScheduler scheduler) {
    this.items = items;
    this.provider = provider;
    this.scheduler = scheduler;
  }

  @EventListener(ApplicationReadyEvent.class)
  public void start() {
    // Placeholder content has one meaning anyway, and would have to be redone by the real provider.
    if ("fake".equals(provider.source())) {
      return;
    }
    List<Long> ids = items.findCompletedIdsWithoutSenses();
    if (!ids.isEmpty()) {
      log.info("Updating {} words with their meanings", ids.size());
      scheduler.schedule(() -> ids.forEach(this::update));
    }
  }

  void update(long id) {
    try {
      VocabularyItem item = items.findById(id).orElseThrow();
      items.markCompleted(id, provider.enrich(item.term()), provider.source(), Instant.now());
    } catch (EnrichmentRejectedException exception) {
      log.warn("Meanings of item {} rejected: {}", id, exception.getMessage());
    } catch (RuntimeException exception) {
      log.warn("Meanings of item {} failed: {}", id, exception.getClass().getSimpleName());
    }
  }
}
