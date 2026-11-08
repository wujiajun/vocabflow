package com.vocabflow.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.vocabflow.identity.infrastructure.UserEntity;
import com.vocabflow.learning.application.StudyService;
import com.vocabflow.tasks.application.TaskService;
import com.vocabflow.vocabulary.application.VocabularyService;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class TaskConcurrencyIT extends MysqlIntegrationTest {
  private static final int RACERS = 6;
  private static final int ROUNDS = 8;

  @Autowired private TaskService tasks;
  @Autowired private StudyService study;
  @Autowired private VocabularyService vocabularyService;

  @Test
  void racingFirstReadsMakeOneListAndNeverFail() throws Exception {
    LocalDate today = LocalDate.now(ZoneOffset.UTC);
    for (int round = 0; round < ROUNDS; round++) {
      long user = users.saveAndFlush(user("tasks-race-" + round + "@example.com")).id;

      List<String> outcomes = race(() -> tasks.day(user, today));

      assertThat(outcomes).as("round %d", round).containsOnly("ok");
      Integer rows =
          jdbcTemplate.queryForObject(
              "SELECT COUNT(*) FROM daily_tasks WHERE user_id = ?", Integer.class, user);
      var day = tasks.day(user, today);
      assertThat(rows).isEqualTo(day.tasks().size());
      assertThat(day.tasks().getFirst().task().key()).isEqualTo("STUDY_PLAN");
    }
  }

  @Test
  void racingReadsAwardEachFinishedTaskOnceOnly() throws Exception {
    LocalDate today = LocalDate.now(ZoneOffset.UTC);
    for (int round = 0; round < ROUNDS; round++) {
      long user = users.saveAndFlush(user("tasks-award-" + round + "@example.com")).id;
      vocabularyService.add(user, "award word " + round);
      study.next(user, today);
      jdbcTemplate.update(
          "UPDATE daily_learning_plans SET finished_at = CURRENT_TIMESTAMP(6) "
              + "WHERE user_id = ? AND learning_date = ?",
          user,
          today);

      List<String> outcomes = race(() -> tasks.day(user, today));

      assertThat(outcomes).as("round %d", round).containsOnly("ok");
      assertThat(
              jdbcTemplate.queryForObject(
                  "SELECT COUNT(*) FROM point_ledger WHERE user_id = ? AND entry_key = 'STUDY_PLAN'",
                  Integer.class,
                  user))
          .isEqualTo(1);
      assertThat(tasks.day(user, today).balance()).isEqualTo(10);
    }
  }

  private List<String> race(Runnable task) throws Exception {
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
                    task.run();
                    return "ok";
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
