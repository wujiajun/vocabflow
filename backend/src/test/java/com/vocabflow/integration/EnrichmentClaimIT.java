package com.vocabflow.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.vocabflow.identity.infrastructure.UserEntity;
import com.vocabflow.vocabulary.application.EnrichmentUsageRepository;
import com.vocabflow.vocabulary.domain.EnrichmentStatus;
import com.vocabflow.vocabulary.infrastructure.VocabularyItemEntity;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class EnrichmentClaimIT extends MysqlIntegrationTest {
  private static final int RACERS = 8;

  @Autowired private EnrichmentUsageRepository usage;

  @Test
  void exactlyOneOfManyRacingClaimersWinsAnItem() throws Exception {
    VocabularyItemEntity item = item("claim race", "PENDING");
    Instant now = Instant.now();

    List<Boolean> outcomes =
        race(
            () ->
                vocabularyItemRepository.claimForEnrichment(
                    item.id,
                    Set.of(EnrichmentStatus.PENDING),
                    now,
                    now.minus(Duration.ofMinutes(5))));

    assertThat(outcomes).filteredOn(won -> won).hasSize(1);
    VocabularyItemEntity claimed = vocabularyItems.findById(item.id).orElseThrow();
    assertThat(claimed.enrichmentStatus).isEqualTo("PROCESSING");
    assertThat(claimed.enrichmentAttempts).isEqualTo(1);
    assertThat(claimed.enrichmentStartedAt).isNotNull();
  }

  @Test
  void claimOnlyTakesTheAllowedStatusesOrALostProcessingWorker() {
    Instant now = Instant.now();
    Instant staleBefore = now.minus(Duration.ofMinutes(5));
    VocabularyItemEntity failed = item("claim failed", "FAILED");
    VocabularyItemEntity completed = item("claim completed", "COMPLETED");
    VocabularyItemEntity fresh = item("claim fresh", "PROCESSING");
    fresh.enrichmentStartedAt = now.minus(Duration.ofMinutes(1));
    vocabularyItems.saveAndFlush(fresh);
    VocabularyItemEntity lost = item("claim lost", "PROCESSING");
    lost.enrichmentStartedAt = now.minus(Duration.ofMinutes(10));
    vocabularyItems.saveAndFlush(lost);
    Set<EnrichmentStatus> pendingOnly = Set.of(EnrichmentStatus.PENDING);

    assertThat(
            vocabularyItemRepository.claimForEnrichment(failed.id, pendingOnly, now, staleBefore))
        .isFalse();
    assertThat(
            vocabularyItemRepository.claimForEnrichment(
                failed.id, Set.of(EnrichmentStatus.FAILED), now, staleBefore))
        .isTrue();
    assertThat(
            vocabularyItemRepository.claimForEnrichment(
                completed.id,
                Set.of(EnrichmentStatus.PENDING, EnrichmentStatus.FAILED),
                now,
                staleBefore))
        .isFalse();
    assertThat(vocabularyItemRepository.claimForEnrichment(fresh.id, pendingOnly, now, staleBefore))
        .isFalse();
    assertThat(vocabularyItemRepository.claimForEnrichment(lost.id, pendingOnly, now, staleBefore))
        .isTrue();
  }

  @Test
  void theDailyLimitHoldsWhenManyCallsRaceAndStartsFreshTheNextDay() throws Exception {
    long user = users.saveAndFlush(user("usage-race@example.com")).id;
    LocalDate day = LocalDate.of(2026, 10, 30);

    List<Boolean> outcomes = race(() -> usage.tryConsume(user, day, 3));

    assertThat(outcomes).filteredOn(allowed -> allowed).hasSize(3);
    assertThat(usage.hasRemaining(user, day, 3)).isFalse();
    assertThat(usage.hasRemaining(user, day.plusDays(1), 3)).isTrue();
    assertThat(usage.tryConsume(user, day.plusDays(1), 3)).isTrue();
    assertThat(usage.tryConsume(user, day, 0)).isFalse();
  }

  @Test
  void racingFirstCallsOfTheDayAreNotMistakenForReachingTheLimit() throws Exception {
    long user = users.saveAndFlush(user("usage-first-race@example.com")).id;

    for (int round = 0; round < 40; round++) {
      LocalDate day = LocalDate.of(2026, 1, 1).plusDays(round);

      List<Boolean> outcomes = race(() -> usage.tryConsume(user, day, 1000));

      assertThat(outcomes).as("round %d, far below the limit", round).containsOnly(true);
    }
  }

  private List<Boolean> race(Callable<Boolean> task) throws Exception {
    ExecutorService executor = Executors.newFixedThreadPool(RACERS);
    CyclicBarrier barrier = new CyclicBarrier(RACERS);
    try {
      List<Future<Boolean>> futures = new ArrayList<>();
      for (int i = 0; i < RACERS; i++) {
        futures.add(
            executor.submit(
                () -> {
                  barrier.await(10, TimeUnit.SECONDS);
                  return task.call();
                }));
      }
      List<Boolean> results = new ArrayList<>();
      for (Future<Boolean> future : futures) {
        results.add(future.get(30, TimeUnit.SECONDS));
      }
      return results;
    } finally {
      executor.shutdownNow();
    }
  }

  private VocabularyItemEntity item(String term, String status) {
    VocabularyItemEntity item = new VocabularyItemEntity();
    item.term = term;
    item.normalizedTerm = term;
    item.enrichmentStatus = status;
    item.createdAt = Instant.now().minus(Duration.ofHours(1));
    return vocabularyItems.saveAndFlush(item);
  }

  private UserEntity user(String email) {
    UserEntity user = new UserEntity();
    user.email = email;
    user.passwordHash = "bcrypt-hash-value";
    user.clbLevel = "CLB_5";
    user.dailyGoal = 10;
    user.createdAt = Instant.parse("2026-01-01T00:00:00Z");
    return user;
  }
}
