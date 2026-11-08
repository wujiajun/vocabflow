package com.vocabflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ProgressApiTests {
  private static final LocalDate TODAY = LocalDate.now(ZoneOffset.UTC);

  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired JdbcTemplate jdbc;

  @Test
  void aNewUserSeesZerosAndTheFirstGoal() throws Exception {
    String token = token("progress-empty@example.com");

    JsonNode s = summary(token, "");

    assertThat(s.path("date").asText()).isEqualTo(TODAY.toString());
    assertThat(s.path("started").asInt()).isZero();
    assertThat(s.path("mastered").asInt()).isZero();
    assertThat(s.path("learning").asInt()).isZero();
    assertThat(s.path("streak").asInt()).isZero();
    assertThat(s.path("milestone").path("previous").asInt()).isZero();
    assertThat(s.path("milestone").path("next").asInt()).isEqualTo(50);
    assertThat(s.path("days")).hasSize(84);
    assertThat(s.path("days").get(83).path("date").asText()).isEqualTo(TODAY.toString());
    assertThat(s.path("days").get(0).path("date").asText())
        .isEqualTo(TODAY.minusDays(83).toString());
    s.path("days")
        .forEach(
            d -> {
              assertThat(d.path("cards").asInt()).isZero();
              assertThat(d.path("points").asInt()).isZero();
            });
    assertThat(s.path("thisWeek").path("reviews").asInt()).isZero();
    assertThat(s.path("lastWeek").path("rounds").asInt()).isZero();
  }

  @Test
  void anIntervalOf21DaysIsMasteredAnd20IsNot() throws Exception {
    String token = token("progress-mature@example.com");
    long user = userId("progress-mature@example.com");
    card(user, "mat-a", "COMPLETED", "REVIEW", 21);
    card(user, "mat-b", "COMPLETED", "REVIEW", 20);
    card(user, "mat-c", "COMPLETED", "REVIEW", 400);
    card(user, "mat-d", "COMPLETED", "LEARNING", 30);
    card(user, "mat-e", "COMPLETED", "RELEARNING", 25);

    JsonNode s = summary(token, "");

    assertThat(s.path("started").asInt()).isEqualTo(5);
    assertThat(s.path("mastered").asInt()).isEqualTo(2);
    assertThat(s.path("learning").asInt()).isEqualTo(3);
  }

  @Test
  void onlyCompletedWordsAreCounted() throws Exception {
    String token = token("progress-status@example.com");
    long user = userId("progress-status@example.com");
    card(user, "st-a", "COMPLETED", "REVIEW", 30);
    card(user, "st-b", "FAILED", "REVIEW", 30);
    card(user, "st-c", "PENDING", "LEARNING", 0);

    JsonNode s = summary(token, "");

    assertThat(s.path("started").asInt()).isEqualTo(1);
    assertThat(s.path("mastered").asInt()).isEqualTo(1);
  }

  @Test
  void theMilestoneMovesWithTheMasteredCount() throws Exception {
    String token = token("progress-mile@example.com");
    long user = userId("progress-mile@example.com");
    for (int i = 0; i < 50; i++) {
      card(user, "mile-" + i, "COMPLETED", "REVIEW", 21);
    }

    JsonNode s = summary(token, "");

    assertThat(s.path("mastered").asInt()).isEqualTo(50);
    assertThat(s.path("milestone").path("previous").asInt()).isEqualTo(50);
    assertThat(s.path("milestone").path("next").asInt()).isEqualTo(100);
  }

  @Test
  void daysAreGroupedByStudyDateWithReviewsNewWordsRoundsAndPoints() throws Exception {
    String token = token("progress-days@example.com");
    long user = userId("progress-days@example.com");
    long a = card(user, "day-a", "COMPLETED", "REVIEW", 5);
    long b = card(user, "day-b", "COMPLETED", "REVIEW", 5);
    LocalDate yesterday = TODAY.minusDays(1);
    log(user, a, "NEW", TODAY);
    log(user, a, "LEARNING", TODAY); // same card twice: still one card
    log(user, b, "REVIEW", TODAY);
    log(user, b, "REVIEW", yesterday);
    round(user, TODAY);
    round(user, TODAY);
    round(user, yesterday);
    ledger(user, TODAY, "STUDY_PLAN", 10);
    ledger(user, TODAY, "ALL_DONE", 5);
    ledger(user, yesterday, "STUDY_PLAN", 10);

    JsonNode s = summary(token, "");
    JsonNode today = s.path("days").get(83);
    JsonNode before = s.path("days").get(82);

    assertThat(today.path("cards").asInt()).isEqualTo(2);
    assertThat(today.path("newWords").asInt()).isEqualTo(1);
    assertThat(today.path("reviews").asInt()).isEqualTo(1);
    assertThat(today.path("rounds").asInt()).isEqualTo(2);
    assertThat(today.path("points").asInt()).isEqualTo(15);
    assertThat(before.path("cards").asInt()).isEqualTo(1);
    assertThat(before.path("reviews").asInt()).isEqualTo(1);
    assertThat(before.path("newWords").asInt()).isZero();
    assertThat(before.path("rounds").asInt()).isEqualTo(1);
    assertThat(before.path("points").asInt()).isEqualTo(10);
    assertThat(s.path("thisWeek").path("reviews").asInt()).isEqualTo(2);
    assertThat(s.path("thisWeek").path("newWords").asInt()).isEqualTo(1);
    assertThat(s.path("thisWeek").path("rounds").asInt()).isEqualTo(3);
  }

  @Test
  void thisWeekAndLastWeekAreTheSevenDaysEndingOnTheDateAndTheSevenBefore() throws Exception {
    String token = token("progress-weeks@example.com");
    long user = userId("progress-weeks@example.com");
    long a = card(user, "wk-a", "COMPLETED", "REVIEW", 5);
    log(user, a, "REVIEW", TODAY.minusDays(6)); // in this week
    log(user, a, "REVIEW", TODAY.minusDays(7)); // in last week
    log(user, a, "REVIEW", TODAY.minusDays(13)); // in last week
    log(user, a, "REVIEW", TODAY.minusDays(14)); // before both

    JsonNode s = summary(token, "");

    assertThat(s.path("thisWeek").path("reviews").asInt()).isEqualTo(1);
    assertThat(s.path("lastWeek").path("reviews").asInt()).isEqualTo(2);
  }

  @Test
  void theStreakIsTheOneTheDailyTasksCount() throws Exception {
    String token = token("progress-streak@example.com");
    long user = userId("progress-streak@example.com");
    for (int back : new int[] {1, 2, 3, 10, 11, 12, 13, 14}) {
      seedBase(user, TODAY.minusDays(back));
    }

    JsonNode s = summary(token, "");

    assertThat(s.path("streak").asInt()).isEqualTo(3);
    assertThat(s.path("bestStreak").asInt()).isEqualTo(5);
  }

  @Test
  void aStoredTimeZoneDecidesTodayAndTheDateParameterIsRangeChecked() throws Exception {
    String token = token("progress-zone@example.com");
    long user = userId("progress-zone@example.com");
    jdbc.update("UPDATE users SET time_zone = 'Pacific/Kiritimati' WHERE id = ?", user);
    LocalDate zoneToday = LocalDate.now(ZoneId.of("Pacific/Kiritimati"));
    long a = card(user, "zone-a", "COMPLETED", "REVIEW", 5);
    log(user, a, "REVIEW", zoneToday); // the learner's day, which may be UTC's tomorrow

    JsonNode s = summary(token, "");

    assertThat(s.path("date").asText()).isEqualTo(zoneToday.toString());
    assertThat(s.path("days").get(83).path("date").asText()).isEqualTo(zoneToday.toString());
    assertThat(s.path("days").get(83).path("cards").asInt()).isEqualTo(1);
    mvc.perform(
            get("/api/v1/progress/summary?date=" + TODAY.minusDays(5))
                .header("Authorization", "Bearer " + token))
        .andExpect(status().isBadRequest());
    mvc.perform(
            get("/api/v1/progress/summary?zone=Nowhere/Land")
                .header("Authorization", "Bearer " + token))
        .andExpect(status().isOk()); // stored zone wins, device zone ignored
  }

  @Test
  void aDeviceZoneIsUsedOnlyWhenNoZoneIsStored() throws Exception {
    String token = token("progress-device@example.com");
    mvc.perform(
            get("/api/v1/progress/summary?zone=Nowhere/Land")
                .header("Authorization", "Bearer " + token))
        .andExpect(status().isBadRequest());
    JsonNode s = summary(token, "?zone=Pacific/Kiritimati");
    assertThat(s.path("date").asText())
        .isEqualTo(LocalDate.now(ZoneId.of("Pacific/Kiritimati")).toString());
  }

  @Test
  void usersOnlySeeTheirOwnProgress() throws Exception {
    String a = token("progress-iso-a@example.com");
    String b = token("progress-iso-b@example.com");
    long userA = userId("progress-iso-a@example.com");
    long cardA = card(userA, "iso-a", "COMPLETED", "REVIEW", 40);
    log(userA, cardA, "NEW", TODAY);
    round(userA, TODAY);
    ledger(userA, TODAY, "STUDY_PLAN", 10);
    seedBase(userA, TODAY);

    JsonNode forB = summary(b, "");
    JsonNode forA = summary(a, "");

    assertThat(forB.path("started").asInt()).isZero();
    assertThat(forB.path("mastered").asInt()).isZero();
    assertThat(forB.path("streak").asInt()).isZero();
    assertThat(forB.path("days").get(83).path("cards").asInt()).isZero();
    assertThat(forB.path("days").get(83).path("rounds").asInt()).isZero();
    assertThat(forB.path("days").get(83).path("points").asInt()).isZero();
    assertThat(forA.path("mastered").asInt()).isEqualTo(1);
    assertThat(forA.path("days").get(83).path("points").asInt()).isEqualTo(10);
    assertThat(forA.path("streak").asInt()).isEqualTo(1);
  }

  @Test
  void signInIsRequired() throws Exception {
    mvc.perform(get("/api/v1/progress/summary")).andExpect(status().isUnauthorized());
  }

  // ---- helpers ----

  private JsonNode summary(String token, String query) throws Exception {
    return json.readTree(
        mvc.perform(
                get("/api/v1/progress/summary" + query).header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString());
  }

  /** A user vocabulary entry with a learning card; returns the entry id. */
  private long card(long user, String term, String enrichment, String state, int interval) {
    jdbc.update(
        "INSERT INTO vocabulary_items (normalized_term, term, enrichment_status, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
        term + "-" + user,
        term,
        enrichment);
    long item =
        jdbc.queryForObject(
            "SELECT id FROM vocabulary_items WHERE normalized_term = ?",
            Long.class,
            term + "-" + user);
    jdbc.update(
        "INSERT INTO user_vocabularies (user_id, vocabulary_item_id, learning_status, created_at) VALUES (?, ?, 'NEW', CURRENT_TIMESTAMP)",
        user,
        item);
    long entry =
        jdbc.queryForObject(
            "SELECT id FROM user_vocabularies WHERE user_id = ? AND vocabulary_item_id = ?",
            Long.class,
            user,
            item);
    jdbc.update(
        "INSERT INTO learning_cards (user_id, user_vocabulary_id, state, step_index, interval_days, ease_permille, reps, lapses, version, created_at) VALUES (?, ?, ?, 0, ?, 2500, 1, 0, 0, CURRENT_TIMESTAMP)",
        user,
        entry,
        state,
        interval);
    return entry;
  }

  private void log(long user, long entry, String stateBefore, LocalDate date) {
    jdbc.update(
        "INSERT INTO review_logs (user_id, user_vocabulary_id, rating, state_before, interval_before, ease_before, state_after, interval_after, ease_after, review_date, reviewed_at) VALUES (?, ?, 'GOOD', ?, 0, 2500, 'REVIEW', 1, 2500, ?, CURRENT_TIMESTAMP)",
        user,
        entry,
        stateBefore,
        date);
  }

  private void round(long user, LocalDate date) {
    jdbc.update(
        "INSERT INTO game_rounds (user_id, game, stars, mistakes, word_count, study_date, finished_at) VALUES (?, 'spell-it', 2, 1, 10, ?, CURRENT_TIMESTAMP)",
        user,
        date);
  }

  private void ledger(long user, LocalDate date, String key, int amount) {
    jdbc.update(
        "INSERT INTO point_ledger (user_id, study_date, entry_key, amount, reason, created_at) VALUES (?, ?, ?, ?, 'x', CURRENT_TIMESTAMP)",
        user,
        date,
        key,
        amount);
  }

  /** A day on which the base task was completed. */
  private void seedBase(long user, LocalDate date) {
    jdbc.update(
        "INSERT INTO daily_task_days (user_id, study_date, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
        user,
        date);
    jdbc.update(
        "INSERT INTO daily_tasks (user_id, study_date, position, task_key, task_type, category, param, target, points, completed_at) VALUES (?, ?, 0, 'STUDY_PLAN', 'STUDY_PLAN', 'STUDY', NULL, 1, 10, CURRENT_TIMESTAMP)",
        user,
        date);
  }

  private long userId(String email) {
    return jdbc.queryForObject("SELECT id FROM users WHERE email = ?", Long.class, email);
  }

  private String token(String email) throws Exception {
    mvc.perform(
            post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"email\":\""
                        + email
                        + "\",\"password\":\"password123\",\"clbLevel\":\"CLB_5\",\"dailyNewVocabularyGoal\":20}"))
        .andExpect(status().isOk());
    return json.readTree(
            mvc.perform(
                    post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"password123\"}"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString())
        .path("accessToken")
        .asText();
  }
}
