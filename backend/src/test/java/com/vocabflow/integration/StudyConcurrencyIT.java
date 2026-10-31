package com.vocabflow.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.vocabflow.identity.infrastructure.UserEntity;
import com.vocabflow.learning.application.StudyService;
import com.vocabflow.learning.domain.Rating;
import com.vocabflow.shared.web.ConflictException;
import com.vocabflow.vocabulary.application.VocabularyService;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class StudyConcurrencyIT extends MysqlIntegrationTest {
  private static final int RACERS = 6;
  private static final int ROUNDS = 10;
  private static final LocalDate DAY = LocalDate.of(2026, 11, 1);

  @Autowired private StudyService study;
  @Autowired private VocabularyService vocabularyService;

  @Test
  void onlyOneOfManyRacingRatingsCountsTheOthersAreRefusedNotServerErrors() throws Exception {
    long user = users.saveAndFlush(user("study-race@example.com")).id;

    for (int round = 0; round < ROUNDS; round++) {
      long id = vocabularyService.add(user, "racing word " + round).id();

      List<String> outcomes = race(user, id);

      assertThat(outcomes).as("round %d", round).containsOnly("ok", "conflict");
      assertThat(outcomes).filteredOn("ok"::equals).hasSize(1);
      assertThat(
              jdbcTemplate.queryForObject(
                  "SELECT COUNT(*) FROM review_logs WHERE user_vocabulary_id = ?",
                  Integer.class,
                  id))
          .isEqualTo(1);
      assertThat(
              jdbcTemplate.queryForObject(
                  "SELECT version FROM learning_cards WHERE user_vocabulary_id = ?",
                  Integer.class,
                  id))
          .isEqualTo(1);
    }
  }

  @Test
  void aPlanWithDueReviewsIsStoredAndKeepsNewAndReviewWordsSeparate() {
    long user = users.saveAndFlush(user("study-plan@example.com")).id;
    long reviewed = vocabularyService.add(user, "reviewed word").id();
    long fresh = vocabularyService.add(user, "fresh word").id();
    study.review(user, reviewed, Rating.EASY, 0, DAY);

    var queue = study.next(user, DAY.plusDays(4));

    assertThat(queue.nextCard().content().userVocabularyId()).isEqualTo(reviewed);
    var plan = dailyLearningPlans.findByUserIdAndLearningDate(user, DAY.plusDays(4)).orElseThrow();
    assertThat(plan.reviewItems())
        .extracting(item -> item.userVocabularyId())
        .containsExactly(reviewed);
    assertThat(plan.newItems()).extracting(item -> item.userVocabularyId()).containsExactly(fresh);
  }

  private List<String> race(long user, long id) throws Exception {
    ExecutorService executor = Executors.newFixedThreadPool(RACERS);
    CyclicBarrier barrier = new CyclicBarrier(RACERS);
    try {
      List<Future<String>> futures = new ArrayList<>();
      for (int i = 0; i < RACERS; i++) {
        futures.add(
            executor.submit(
                () -> {
                  barrier.await(10, TimeUnit.SECONDS);
                  try {
                    study.review(user, id, Rating.GOOD, 0, DAY);
                    return "ok";
                  } catch (ConflictException conflict) {
                    return "conflict";
                  } catch (Exception other) {
                    return other.getClass().getSimpleName();
                  }
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
