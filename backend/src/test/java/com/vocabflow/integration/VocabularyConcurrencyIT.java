package com.vocabflow.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.vocabflow.identity.infrastructure.UserEntity;
import com.vocabflow.shared.web.ConflictException;
import com.vocabflow.vocabulary.application.VocabularyService;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class VocabularyConcurrencyIT extends MysqlIntegrationTest {
  private static final int ROUNDS = 20;

  @Autowired private VocabularyService vocabularyService;

  @Test
  void differentUsersAddingTheSameNewTermConcurrentlyBothSucceed() throws Exception {
    long firstUser = users.saveAndFlush(user("concurrent-first@example.com")).id;
    long secondUser = users.saveAndFlush(user("concurrent-second@example.com")).id;
    Map<String, Integer> outcomes = new TreeMap<>();

    for (int round = 0; round < ROUNDS; round++) {
      String term = "shared concurrent term " + round;
      List<String> results = race(add(firstUser, term), add(secondUser, term));
      results.forEach(result -> outcomes.merge(result, 1, Integer::sum));
    }

    assertThat(outcomes).as("outcomes across %d rounds", ROUNDS).containsOnlyKeys("success");
    assertThat(vocabularyItems.count()).isEqualTo(ROUNDS);
    assertThat(userVocabularies.count()).isEqualTo(ROUNDS * 2L);
    assertThat(vocabularyItems.findAll())
        .allSatisfy(item -> assertThat(item.enrichmentStatus).isEqualTo("COMPLETED"))
        .allSatisfy(
            item -> assertThat(item.enrichmentAttempts).as("one claim per item").isEqualTo(1));
  }

  @Test
  void sameUserAddingTheSameNewTermConcurrentlySucceedsOnceAndConflictsOtherwise()
      throws Exception {
    long user = users.saveAndFlush(user("concurrent-single@example.com")).id;
    Map<String, Integer> outcomes = new TreeMap<>();

    for (int round = 0; round < ROUNDS; round++) {
      String term = "single user concurrent term " + round;
      List<String> results = race(add(user, term), add(user, term), add(user, term));
      results.forEach(result -> outcomes.merge(result, 1, Integer::sum));
    }

    assertThat(outcomes)
        .as("outcomes across %d rounds of 3 racing requests", ROUNDS)
        .containsOnlyKeys("success", ConflictException.class.getSimpleName())
        .containsEntry("success", ROUNDS);
    assertThat(vocabularyItems.count()).isEqualTo(ROUNDS);
    assertThat(userVocabularies.count()).isEqualTo(ROUNDS);
  }

  private Callable<String> add(long userId, String term) {
    return () -> {
      try {
        vocabularyService.add(userId, term);
        return "success";
      } catch (Exception exception) {
        return exception.getClass().getSimpleName();
      }
    };
  }

  @SafeVarargs
  private List<String> race(Callable<String>... requests) throws Exception {
    ExecutorService executor = Executors.newFixedThreadPool(requests.length);
    CyclicBarrier barrier = new CyclicBarrier(requests.length);
    try {
      List<Future<String>> futures = new ArrayList<>();
      for (Callable<String> request : requests) {
        futures.add(
            executor.submit(
                () -> {
                  barrier.await(10, TimeUnit.SECONDS);
                  return request.call();
                }));
      }
      List<String> results = new ArrayList<>();
      for (Future<String> future : futures) {
        results.add(future.get(30, TimeUnit.SECONDS));
      }
      return results;
    } finally {
      executor.shutdownNow();
    }
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
