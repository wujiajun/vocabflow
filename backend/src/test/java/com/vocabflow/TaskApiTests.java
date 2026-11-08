package com.vocabflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TaskApiTests {
  private static final LocalDate TODAY = LocalDate.now(ZoneOffset.UTC);

  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired JdbcTemplate jdbc;

  @Test
  void aDayHasTheBaseTaskFirstThenDifferentCategoriesAndStaysTheSame() throws Exception {
    String token = token("tasks-list@example.com");
    add(token, "list word one");

    JsonNode first = today(token);
    JsonNode second = today(token);

    assertThat(first.path("date").asText()).isEqualTo(TODAY.toString());
    assertThat(first.path("tasks").get(0).path("type").asText()).isEqualTo("STUDY_PLAN");
    assertThat(first.path("tasks").get(0).path("points").asInt()).isEqualTo(10);
    assertThat(first.path("tasks").size()).isBetween(2, 5);
    assertThat(first.path("tasks")).isEqualTo(second.path("tasks"));
    List<String> categories = new java.util.ArrayList<>();
    first.path("tasks").forEach(t -> categories.add(t.path("category").asText()));
    categories.removeFirst();
    assertThat(categories).doesNotHaveDuplicates();
    assertThat(first.path("tasks").get(0).path("completed").asBoolean()).isFalse();
    assertThat(first.path("balance").asInt()).isZero();
    assertThat(first.path("streak").asInt()).isZero();
    assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM daily_tasks WHERE user_id = ?",
                Integer.class,
                userId("tasks-list@example.com")))
        .isEqualTo(first.path("tasks").size());
  }

  @Test
  void finishingThePlanEarnsTheBaseTaskOnceAndStartsTheStreak() throws Exception {
    String token = token("tasks-base@example.com");
    long user = userId("tasks-base@example.com");
    add(token, "base word one");
    plan(token);
    finishPlan(user, TODAY);

    JsonNode day = today(token);
    assertThat(day.path("tasks").get(0).path("completed").asBoolean()).isTrue();
    assertThat(day.path("tasks").get(0).path("current").asInt()).isEqualTo(1);
    assertThat(day.path("earnedToday").asInt()).isEqualTo(10);
    assertThat(day.path("balance").asInt()).isEqualTo(10);
    assertThat(day.path("streak").asInt()).isEqualTo(1);

    today(token);
    today(token);
    assertThat(today(token).path("balance").asInt()).isEqualTo(10);
    assertThat(count("point_ledger", user)).isEqualTo(1);
  }

  @Test
  void eachKindOfTaskIsCompletedFromItsOwnData() throws Exception {
    String token = token("tasks-kinds@example.com");
    long user = userId("tasks-kinds@example.com");
    seed(user, TODAY, "STUDY_PLAN", null, "STUDY", 1, 10, 0);
    seed(user, TODAY, "ADD_WORDS", null, "ADD_WORDS", 2, 3, 1);
    seed(user, TODAY, "READ_ARTICLE", null, "READING", 1, 4, 2);
    seed(user, TODAY, "WATCH_VIDEO", null, "VIDEO", 1, 3, 3);
    seed(user, TODAY, "PLAY_GAME", "spell-it", "GAMES", 1, 3, 4);

    JsonNode before = today(token);
    assertThat(before.path("tasks"))
        .allSatisfy(t -> assertThat(t.path("current").asInt()).isZero());

    add(token, "kinds word one");
    JsonNode midway = today(token);
    assertThat(midway.path("tasks").get(1).path("current").asInt()).isEqualTo(1);
    assertThat(midway.path("tasks").get(1).path("completed").asBoolean()).isFalse();
    add(token, "kinds word two");
    mvc.perform(
            put("/api/v1/articles/" + anyArticleId(token) + "/read")
                .header("Authorization", "Bearer " + token))
        .andExpect(status().is2xxSuccessful());
    mvc.perform(
            put("/api/v1/videos/WR9_nsLyaEY/watched").header("Authorization", "Bearer " + token))
        .andExpect(status().is2xxSuccessful());
    round(token, "quick-review", 3).andExpect(status().isCreated());

    JsonNode after = today(token);
    assertThat(after.path("tasks").get(0).path("completed").asBoolean()).isFalse();
    assertThat(after.path("tasks").get(1).path("completed").asBoolean()).as("add words").isTrue();
    assertThat(after.path("tasks").get(2).path("completed").asBoolean()).as("article").isTrue();
    assertThat(after.path("tasks").get(3).path("completed").asBoolean()).as("video").isTrue();
    assertThat(after.path("tasks").get(4).path("completed").asBoolean())
        .as("another game does not count")
        .isFalse();
    assertThat(after.path("earnedToday").asInt()).isEqualTo(3 + 4 + 3);

    round(token, "spell-it", 1).andExpect(status().isCreated());
    assertThat(today(token).path("tasks").get(4).path("completed").asBoolean()).isTrue();
  }

  @Test
  void gameTasksCountRoundsAndStarsAndAWordTappedInAnArticleIsCounted() throws Exception {
    String token = token("tasks-games@example.com");
    long user = userId("tasks-games@example.com");
    seed(user, TODAY, "STUDY_PLAN", null, "STUDY", 1, 10, 0);
    seed(user, TODAY, "STARS_ROUND", null, "GAMES", 1, 5, 1);
    seed(user, TODAY, "ADD_WORD_FROM_ARTICLE", null, "ADD_WORDS", 1, 4, 2);

    round(token, "fill-blank", 1).andExpect(status().isCreated());
    assertThat(today(token).path("tasks").get(1).path("completed").asBoolean()).isFalse();
    round(token, "fill-blank", 2).andExpect(status().isCreated());
    add(token, "plain typed word");
    JsonNode day = today(token);
    assertThat(day.path("tasks").get(1).path("completed").asBoolean()).isTrue();
    assertThat(day.path("tasks").get(2).path("completed").asBoolean())
        .as("typed, not tapped")
        .isFalse();

    mvc.perform(
            post("/api/v1/vocabulary")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"term\":\"tapped word\",\"sentence\":\"A tapped word here.\","
                        + "\"form\":\"tapped word\",\"sourceTitle\":\"Story\","
                        + "\"sourceLink\":\"/app/reading/articles/a/12345\"}"))
        .andExpect(status().isOk());
    assertThat(today(token).path("tasks").get(2).path("completed").asBoolean()).isTrue();
  }

  @Test
  void allTasksDoneAddsTheBonusAndStreakBonusesComeOncePerRun() throws Exception {
    String token = token("tasks-bonus@example.com");
    long user = userId("tasks-bonus@example.com");
    // Two earlier days with the base task done: today makes three in a row.
    for (int back = 1; back <= 2; back++) {
      seedDone(user, TODAY.minusDays(back));
    }
    seed(user, TODAY, "STUDY_PLAN", null, "STUDY", 1, 10, 0);
    seed(user, TODAY, "PLAY_ROUND", null, "GAMES", 1, 2, 1);
    add(token, "bonus word");
    plan(token);
    finishPlan(user, TODAY);
    round(token, "listen-choose", 0).andExpect(status().isCreated());

    JsonNode day = today(token);
    assertThat(day.path("allDone").asBoolean()).isTrue();
    assertThat(day.path("streak").asInt()).isEqualTo(3);
    assertThat(day.path("bestStreak").asInt()).isEqualTo(3);
    // 10 + 2 + all done 5 + streak-3 bonus 5
    assertThat(day.path("earnedToday").asInt()).isEqualTo(22);
    assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM point_ledger WHERE user_id = ? AND entry_key IN ('ALL_DONE','STREAK_3')",
                Integer.class,
                user))
        .isEqualTo(2);

    today(token);
    assertThat(today(token).path("balance").asInt()).isEqualTo(22);
  }

  @Test
  void aMissedDayRestartsTheStreakWithoutTakingPointsAway() throws Exception {
    String token = token("tasks-missed@example.com");
    long user = userId("tasks-missed@example.com");
    seedDone(user, TODAY.minusDays(3));
    seedDone(user, TODAY.minusDays(2));
    jdbc.update(
        "INSERT INTO point_ledger (user_id, study_date, entry_key, amount, reason, created_at) VALUES (?, ?, 'STUDY_PLAN', 10, 'x', CURRENT_TIMESTAMP)",
        user,
        TODAY.minusDays(3));

    JsonNode day = today(token);
    assertThat(day.path("streak").asInt()).as("yesterday missed").isZero();
    assertThat(day.path("bestStreak").asInt()).isEqualTo(2);
    assertThat(day.path("balance").asInt()).isEqualTo(10);
  }

  @Test
  void aStreakStillShowsWhileTodayIsNotDoneYet() throws Exception {
    String token = token("tasks-alive@example.com");
    long user = userId("tasks-alive@example.com");
    seedDone(user, TODAY.minusDays(2));
    seedDone(user, TODAY.minusDays(1));

    assertThat(today(token).path("streak").asInt()).isEqualTo(2);
  }

  @Test
  void usersNeverSeeEachOthersTasksPointsOrStreak() throws Exception {
    String a = token("tasks-iso-a@example.com");
    String b = token("tasks-iso-b@example.com");
    long idA = userId("tasks-iso-a@example.com");
    add(a, "iso word");
    plan(a);
    finishPlan(idA, TODAY);
    seedDone(idA, TODAY.minusDays(1));

    assertThat(today(a).path("balance").asInt()).isEqualTo(10);
    JsonNode other = today(b);
    assertThat(other.path("balance").asInt()).isZero();
    assertThat(other.path("streak").asInt()).isZero();
    assertThat(other.path("tasks").get(0).path("completed").asBoolean()).isFalse();
    assertThat(ledger(b, 0, 20).path("entries")).isEmpty();
    assertThat(ledger(a, 0, 20).path("entries")).isNotEmpty();
  }

  @Test
  void theLedgerIsPagedNewestFirst() throws Exception {
    String token = token("tasks-ledger@example.com");
    long user = userId("tasks-ledger@example.com");
    for (int i = 0; i < 5; i++) {
      jdbc.update(
          "INSERT INTO point_ledger (user_id, study_date, entry_key, amount, reason, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
          user,
          TODAY.minusDays(10 - i),
          "K" + i,
          i + 1,
          "line " + i);
    }

    JsonNode first = ledger(token, 0, 2);
    assertThat(first.path("totalElements").asInt()).isEqualTo(5);
    assertThat(first.path("totalPages").asInt()).isEqualTo(3);
    assertThat(first.path("entries").get(0).path("reason").asText()).isEqualTo("line 4");
    assertThat(first.path("entries").get(1).path("reason").asText()).isEqualTo("line 3");
    JsonNode last = ledger(token, 2, 2);
    assertThat(last.path("entries")).hasSize(1);
    assertThat(last.path("entries").get(0).path("reason").asText()).isEqualTo("line 0");
    mvc.perform(get("/api/v1/tasks/ledger?size=0").header("Authorization", "Bearer " + token))
        .andExpect(status().isBadRequest());
    mvc.perform(get("/api/v1/tasks/ledger?page=-1").header("Authorization", "Bearer " + token))
        .andExpect(status().isBadRequest());
  }

  @Test
  void onlyTodayIsGradedOtherDaysAreShownAsStored() throws Exception {
    String token = token("tasks-past@example.com");
    long user = userId("tasks-past@example.com");
    jdbc.update("UPDATE users SET time_zone = 'UTC' WHERE id = ?", user);
    LocalDate yesterday = TODAY.minusDays(1);
    seed(user, yesterday, "STUDY_PLAN", null, "STUDY", 1, 10, 0);
    seed(user, yesterday, "PLAY_ROUND", null, "GAMES", 1, 2, 1);
    round(token, "spell-it", 3, yesterday).andExpect(status().isCreated());

    JsonNode past = today(token, yesterday);
    assertThat(past.path("tasks")).hasSize(2);
    assertThat(past.path("tasks").get(1).path("completed").asBoolean()).isFalse();
    assertThat(count("point_ledger", user)).isZero();
    assertThat(today(token, TODAY.minusDays(5)).path("tasks")).isEmpty();
    mvc.perform(
            get("/api/v1/tasks/today?date=" + TODAY.minusDays(5))
                .header("Authorization", "Bearer " + token))
        .andExpect(status().isBadRequest());
  }

  @Test
  void withATimeZoneTheServerDecidesWhichDateIsToday() throws Exception {
    String token = token("tasks-zone@example.com");
    long user = userId("tasks-zone@example.com");
    jdbc.update("UPDATE users SET time_zone = 'Pacific/Kiritimati' WHERE id = ?", user);
    LocalDate zoneToday = LocalDate.now(java.time.ZoneId.of("Pacific/Kiritimati"));

    // Without a date the user's own day is used.
    JsonNode own =
        json.readTree(
            mvc.perform(get("/api/v1/tasks/today").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString());
    assertThat(own.path("date").asText()).isEqualTo(zoneToday.toString());
    assertThat(own.path("tasks")).isNotEmpty();
    // The UTC date is the zone's yesterday here: nothing is made or graded for it.
    if (!zoneToday.equals(TODAY)) {
      assertThat(today(token, TODAY).path("tasks")).isEmpty();
    }
  }

  @Test
  void withoutAStoredZoneTheDevicesZoneSetsTheWindowOfTheDay() throws Exception {
    String token = token("tasks-device@example.com");
    long user = userId("tasks-device@example.com");
    seed(user, TODAY, "STUDY_PLAN", null, "STUDY", 1, 10, 0);
    seed(user, TODAY, "ADD_WORDS", null, "ADD_WORDS", 1, 3, 1);
    // A word added 20 hours ago is yesterday for a UTC day only if the window starts later; put it
    // just after the start of today in a zone far ahead of UTC.
    java.time.ZoneId far = java.time.ZoneId.of("Pacific/Kiritimati");
    Instant startOfDay = TODAY.atStartOfDay(far).toInstant().plusSeconds(60);
    add(token, "device zone word");
    jdbc.update(
        "UPDATE user_vocabularies SET created_at = ? WHERE user_id = ?",
        java.sql.Timestamp.from(startOfDay),
        user);

    String url = "/api/v1/tasks/today?date=" + TODAY;
    JsonNode utcWindow =
        json.readTree(
            mvc.perform(get(url).header("Authorization", "Bearer " + token))
                .andReturn()
                .getResponse()
                .getContentAsString());
    JsonNode deviceWindow =
        json.readTree(
            mvc.perform(
                    get(url + "&zone=Pacific/Kiritimati")
                        .header("Authorization", "Bearer " + token))
                .andReturn()
                .getResponse()
                .getContentAsString());

    assertThat(utcWindow.path("tasks").get(1).path("completed").asBoolean()).isFalse();
    assertThat(deviceWindow.path("tasks").get(1).path("completed").asBoolean()).isTrue();
    mvc.perform(get(url + "&zone=Nowhere/Land").header("Authorization", "Bearer " + token))
        .andExpect(status().isBadRequest());
  }

  @Test
  void racingFirstReadsMakeOneList() throws Exception {
    String token = token("tasks-race@example.com");
    long user = userId("tasks-race@example.com");
    add(token, "race word");
    int racers = 6;
    ExecutorService executor = Executors.newFixedThreadPool(racers);
    CyclicBarrier barrier = new CyclicBarrier(racers);
    try {
      List<Future<Integer>> futures = new java.util.ArrayList<>();
      for (int i = 0; i < racers; i++) {
        futures.add(
            executor.submit(
                () -> {
                  barrier.await(10, TimeUnit.SECONDS);
                  return mvc.perform(
                          get("/api/v1/tasks/today").header("Authorization", "Bearer " + token))
                      .andReturn()
                      .getResponse()
                      .getStatus();
                }));
      }
      for (Future<Integer> future : futures) {
        assertThat(future.get(30, TimeUnit.SECONDS)).isEqualTo(200);
      }
    } finally {
      executor.shutdownNow();
    }
    assertThat(count("daily_tasks", user)).isEqualTo(today(token).path("tasks").size());
  }

  @Test
  void signInIsRequired() throws Exception {
    mvc.perform(get("/api/v1/tasks/today")).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/v1/tasks/ledger")).andExpect(status().isUnauthorized());
  }

  // ---- helpers ----

  private void seed(
      long user,
      LocalDate date,
      String type,
      String param,
      String category,
      int target,
      int points,
      int position) {
    jdbc.update(
        "INSERT INTO daily_tasks (user_id, study_date, position, task_key, task_type, category, param, target, points) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        user,
        date,
        position,
        param == null ? type : type + ":" + param,
        type,
        category,
        param,
        target,
        points);
  }

  private void seedDone(long user, LocalDate date) {
    seed(user, date, "STUDY_PLAN", null, "STUDY", 1, 10, 0);
    jdbc.update(
        "UPDATE daily_tasks SET completed_at = ? WHERE user_id = ? AND study_date = ?",
        java.sql.Timestamp.from(Instant.now()),
        user,
        date);
  }

  private void finishPlan(long user, LocalDate date) {
    jdbc.update(
        "UPDATE daily_learning_plans SET finished_at = CURRENT_TIMESTAMP WHERE user_id = ? AND learning_date = ?",
        user,
        date);
  }

  private int count(String table, long user) {
    return jdbc.queryForObject(
        "SELECT COUNT(*) FROM " + table + " WHERE user_id = ?", Integer.class, user);
  }

  private void plan(String token) throws Exception {
    mvc.perform(
            get("/api/v1/learning/daily-plan?date=" + TODAY)
                .header("Authorization", "Bearer " + token))
        .andExpect(status().isOk());
  }

  private String anyArticleId(String token) throws Exception {
    JsonNode albums =
        json.readTree(
            mvc.perform(get("/api/v1/articles/albums").header("Authorization", "Bearer " + token))
                .andReturn()
                .getResponse()
                .getContentAsString());
    String albumId = albums.get(0).path("id").asText();
    return json.readTree(
            mvc.perform(
                    get("/api/v1/articles/albums/" + albumId)
                        .header("Authorization", "Bearer " + token))
                .andReturn()
                .getResponse()
                .getContentAsString())
        .path("articles")
        .get(0)
        .path("id")
        .asText();
  }

  private JsonNode today(String token) throws Exception {
    return today(token, TODAY);
  }

  private JsonNode today(String token, LocalDate date) throws Exception {
    return json.readTree(
        mvc.perform(
                get("/api/v1/tasks/today?date=" + date).header("Authorization", "Bearer " + token))
            .andReturn()
            .getResponse()
            .getContentAsString());
  }

  private JsonNode ledger(String token, int page, int size) throws Exception {
    return json.readTree(
        mvc.perform(
                get("/api/v1/tasks/ledger?page=" + page + "&size=" + size)
                    .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString());
  }

  private ResultActions round(String token, String game, int stars) throws Exception {
    return round(token, game, stars, TODAY);
  }

  private ResultActions round(String token, String game, int stars, LocalDate date)
      throws Exception {
    return mvc.perform(
        post("/api/v1/learning/game-rounds")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(
                "{\"game\":\""
                    + game
                    + "\",\"stars\":"
                    + stars
                    + ",\"mistakes\":0,\"wordCount\":10,\"date\":\""
                    + date
                    + "\"}"));
  }

  private long add(String token, String term) throws Exception {
    return json.readTree(
            mvc.perform(
                    post("/api/v1/vocabulary")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"term\":\"" + term + "\"}"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString())
        .path("id")
        .asLong();
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
