package com.vocabflow.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.vocabflow.identity.infrastructure.UserEntity;
import com.vocabflow.progress.application.ProgressService;
import com.vocabflow.progress.application.ProgressSummary;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** The progress queries on real MySQL (native joins, grouped counts, case expressions). */
class ProgressIT extends MysqlIntegrationTest {
  @Autowired private ProgressService progress;

  @Test
  void countsMasteryByTheIntervalAndGroupsDaysOnMysql() {
    LocalDate today = LocalDate.now(ZoneOffset.UTC);
    long user = users.saveAndFlush(user("progress-it@example.com")).id;
    long mature = card(user, "pit-a", "COMPLETED", "REVIEW", 21);
    card(user, "pit-b", "COMPLETED", "REVIEW", 20);
    card(user, "pit-c", "FAILED", "REVIEW", 99);
    log(user, mature, "NEW", today);
    log(user, mature, "LEARNING", today);
    jdbcTemplate.update(
        "INSERT INTO game_rounds (user_id, game, stars, mistakes, word_count, study_date, finished_at) VALUES (?, 'spell-it', 2, 0, 10, ?, CURRENT_TIMESTAMP(6))",
        user,
        today);
    jdbcTemplate.update(
        "INSERT INTO point_ledger (user_id, study_date, entry_key, amount, reason, created_at) VALUES (?, ?, 'STUDY_PLAN', 10, 'x', CURRENT_TIMESTAMP(6))",
        user,
        today);

    ProgressSummary s = progress.summary(user, today, null);

    assertThat(s.started()).isEqualTo(2);
    assertThat(s.mastered()).isEqualTo(1);
    assertThat(s.learning()).isEqualTo(1);
    var last = s.days().getLast();
    assertThat(last.cards()).isEqualTo(1);
    assertThat(last.newWords()).isEqualTo(1);
    assertThat(last.rounds()).isEqualTo(1);
    assertThat(last.points()).isEqualTo(10);
    assertThat(s.days()).hasSize(84);
  }

  private long card(long user, String term, String status, String state, int interval) {
    jdbcTemplate.update(
        "INSERT INTO vocabulary_items (normalized_term, term, enrichment_status, created_at, enrichment_attempts) VALUES (?, ?, ?, CURRENT_TIMESTAMP(6), 0)",
        term,
        term,
        status);
    long item =
        jdbcTemplate.queryForObject(
            "SELECT id FROM vocabulary_items WHERE normalized_term = ?", Long.class, term);
    jdbcTemplate.update(
        "INSERT INTO user_vocabularies (user_id, vocabulary_item_id, learning_status, created_at) VALUES (?, ?, 'NEW', CURRENT_TIMESTAMP(6))",
        user,
        item);
    long entry =
        jdbcTemplate.queryForObject(
            "SELECT id FROM user_vocabularies WHERE user_id = ? AND vocabulary_item_id = ?",
            Long.class,
            user,
            item);
    jdbcTemplate.update(
        "INSERT INTO learning_cards (user_id, user_vocabulary_id, state, step_index, interval_days, ease_permille, reps, lapses, version, created_at) VALUES (?, ?, ?, 0, ?, 2500, 1, 0, 0, CURRENT_TIMESTAMP(6))",
        user,
        entry,
        state,
        interval);
    return entry;
  }

  private void log(long user, long entry, String before, LocalDate date) {
    jdbcTemplate.update(
        "INSERT INTO review_logs (user_id, user_vocabulary_id, rating, state_before, interval_before, ease_before, state_after, interval_after, ease_after, review_date, reviewed_at) VALUES (?, ?, 'GOOD', ?, 0, 2500, 'REVIEW', 1, 2500, ?, CURRENT_TIMESTAMP(6))",
        user,
        entry,
        before,
        date);
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
