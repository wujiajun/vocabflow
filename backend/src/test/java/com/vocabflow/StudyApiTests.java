package com.vocabflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class StudyApiTests {
  private static final LocalDate DAY_ONE = LocalDate.of(2026, 11, 1);

  static final class MovableClock extends Clock {
    Instant now = Instant.parse("2026-11-01T12:00:00Z");

    @Override
    public ZoneId getZone() {
      return ZoneOffset.UTC;
    }

    @Override
    public Clock withZone(ZoneId zone) {
      return this;
    }

    @Override
    public Instant instant() {
      return now;
    }
  }

  @TestConfiguration
  static class Config {
    @Bean
    @Primary
    MovableClock movableClock() {
      return new MovableClock();
    }
  }

  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired MovableClock clock;
  @Autowired JdbcTemplate jdbc;

  @Test
  void aNewWordGoesThroughLearningIntoReviewAndComesBackWhenDue() throws Exception {
    String token = token("study-path@example.com", 10);
    long id = add(token, "first study word");

    JsonNode queue = queue(token, DAY_ONE);
    assertThat(queue.path("newCount").asInt()).isEqualTo(1);
    JsonNode card = queue.path("nextCard");
    assertThat(card.path("userVocabularyId").asLong()).isEqualTo(id);
    assertThat(card.path("state").asText()).isEqualTo("NEW");
    assertThat(card.path("definition").asText()).isNotBlank();
    assertThat(option(card, "AGAIN").path("intervalMinutes").asInt()).isEqualTo(1);
    assertThat(option(card, "GOOD").path("intervalMinutes").asInt()).isEqualTo(10);
    assertThat(option(card, "EASY").path("intervalDays").asInt()).isEqualTo(4);
    assertThat(option(card, "EASY").path("intervalMinutes").isNull()).isTrue();

    // GOOD: the second learning step. Nothing else is left, so it is offered ahead of time.
    JsonNode afterGood = review(token, id, "GOOD", 0, DAY_ONE);
    assertThat(afterGood.path("nextCard").path("state").asText()).isEqualTo("LEARNING");
    assertThat(afterGood.path("nextCard").path("version").asInt()).isEqualTo(1);
    assertThat(learningStatus(token, id)).isEqualTo("LEARNING");

    // GOOD again: graduates to a one-day interval, so today is finished.
    JsonNode finished = review(token, id, "GOOD", 1, DAY_ONE);
    assertThat(finished.path("nextCard").isNull()).isTrue();
    assertThat(finished.path("nextDueAt").isNull()).isTrue();
    assertThat(finished.path("reviewCount").asInt()).isZero();
    assertThat(learningStatus(token, id)).isEqualTo("FAMILIAR");

    JsonNode tomorrow = queue(token, DAY_ONE.plusDays(1));
    assertThat(tomorrow.path("reviewCount").asInt()).isEqualTo(1);
    assertThat(tomorrow.path("newCount").asInt()).isZero();
    assertThat(tomorrow.path("nextCard").path("state").asText()).isEqualTo("REVIEW");
    assertThat(option(tomorrow.path("nextCard"), "GOOD").path("intervalDays").asInt()).isEqualTo(3);

    JsonNode plan = plan(token, DAY_ONE.plusDays(1));
    assertThat(plan.path("newItems")).isEmpty();
    assertThat(plan.path("reviewItems").get(0).path("userVocabularyId").asLong()).isEqualTo(id);

    assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM review_logs WHERE user_vocabulary_id = ?", Integer.class, id))
        .isEqualTo(2);
  }

  @Test
  void aStudiedWordLeavesTheNewWordsSoTheNextDayOffersTheNextOnes() throws Exception {
    String token = token("study-next-words@example.com", 1);
    long first = add(token, "next day first");
    long second = add(token, "next day second");

    assertThat(queue(token, DAY_ONE).path("nextCard").path("userVocabularyId").asLong())
        .isEqualTo(first);
    review(token, first, "EASY", 0, DAY_ONE);

    JsonNode nextDay = plan(token, DAY_ONE.plusDays(1));
    assertThat(nextDay.path("newItems").get(0).path("userVocabularyId").asLong()).isEqualTo(second);
  }

  @Test
  void showsLearningStepsDueNowBeforeReviewsAndNewWords() throws Exception {
    String token = token("study-order@example.com", 10);
    long review = add(token, "order review");
    review(token, review, "EASY", 0, DAY_ONE);
    long learning = add(token, "order learning");
    long fresh = add(token, "order fresh");

    LocalDate later = DAY_ONE.plusDays(4);
    review(token, learning, "AGAIN", 0, later);
    assertThat(queue(token, later).path("nextCard").path("userVocabularyId").asLong())
        .as("a due review comes before a new word and a step that is not due yet")
        .isEqualTo(review);

    clock.now = clock.now.plus(Duration.ofMinutes(2));
    JsonNode queue = queue(token, later);
    assertThat(queue.path("nextCard").path("userVocabularyId").asLong())
        .as("the step is due now")
        .isEqualTo(learning);
    assertThat(queue.path("reviewCount").asInt()).isEqualTo(1);
    assertThat(queue.path("newCount").asInt()).as("only the word not yet rated").isEqualTo(1);

    review(token, learning, "EASY", 1, later);
    JsonNode afterStep = review(token, review, "GOOD", 1, later);
    assertThat(afterStep.path("nextCard").path("userVocabularyId").asLong())
        .as("new words come last")
        .isEqualTo(fresh);
    clock.now = clock.now.minus(Duration.ofMinutes(2));
  }

  @Test
  void aLearningStepFarAwayIsReportedInsteadOfShownEarly() throws Exception {
    String token = token("study-wait@example.com", 10);
    long id = add(token, "wait word");
    review(token, id, "GOOD", 0, DAY_ONE);
    Instant start = clock.now;

    jdbc.update(
        "UPDATE learning_cards SET due_at = ? WHERE user_vocabulary_id = ?",
        java.sql.Timestamp.from(start.plus(Duration.ofHours(2))),
        id);

    JsonNode queue = queue(token, DAY_ONE);
    assertThat(queue.path("nextCard").isNull()).isTrue();
    assertThat(queue.path("learningCount").asInt()).isZero();
    assertThat(Instant.parse(queue.path("nextDueAt").asText()))
        .isEqualTo(start.plus(Duration.ofHours(2)));
  }

  @Test
  void aRatingBasedOnAnOutOfDateCardIsRefusedAndChangesNothing() throws Exception {
    String token = token("study-stale@example.com", 10);
    long id = add(token, "stale word");
    review(token, id, "GOOD", 0, DAY_ONE);

    postReview(token, id, "EASY", 0, DAY_ONE)
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("CONFLICT"));

    assertThat(learningStatus(token, id)).isEqualTo("LEARNING");
    assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM review_logs WHERE user_vocabulary_id = ?", Integer.class, id))
        .isEqualTo(1);
  }

  @Test
  void aUserCannotSeeOrRateAnotherUsersWords() throws Exception {
    String owner = token("study-owner@example.com", 10);
    String other = token("study-other@example.com", 10);
    long id = add(owner, "private study word");

    assertThat(queue(other, DAY_ONE).path("nextCard").isNull()).isTrue();
    postReview(other, id, "GOOD", 0, DAY_ONE)
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    assertThat(queue(owner, DAY_ONE).path("nextCard").path("state").asText()).isEqualTo("NEW");
  }

  @Test
  void requiresSignInAndAValidRequest() throws Exception {
    mvc.perform(get("/api/v1/learning/study-queue")).andExpect(status().isUnauthorized());
    mvc.perform(post("/api/v1/learning/cards/1/reviews")).andExpect(status().isUnauthorized());

    String token = token("study-invalid@example.com", 10);
    long id = add(token, "invalid request word");
    for (String body :
        List.of(
            "{\"rating\":\"GOOD\",\"version\":0}",
            "{\"rating\":\"GOOD\",\"date\":\"2026-11-01\"}",
            "{\"version\":0,\"date\":\"2026-11-01\"}",
            "{\"rating\":\"GOOD\",\"version\":-1,\"date\":\"2026-11-01\"}")) {
      mvc.perform(
              post("/api/v1/learning/cards/" + id + "/reviews")
                  .header("Authorization", "Bearer " + token)
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(body))
          .andExpect(status().isBadRequest())
          .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }
    mvc.perform(
            post("/api/v1/learning/cards/" + id + "/reviews")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"rating\":\"MAYBE\",\"version\":0,\"date\":\"2026-11-01\"}"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void wordsAddedAfterAnEmptyStartStillGetAPlanThatDay() throws Exception {
    String token = token("study-empty-start@example.com", 10);

    JsonNode empty = queue(token, DAY_ONE);
    assertThat(empty.path("nextCard").isNull()).isTrue();
    assertThat(plan(token, DAY_ONE).path("newItems")).isEmpty();

    long id = add(token, "added after empty start");

    assertThat(plan(token, DAY_ONE).path("newItems").get(0).path("userVocabularyId").asLong())
        .isEqualTo(id);
    assertThat(queue(token, DAY_ONE).path("nextCard").path("userVocabularyId").asLong())
        .isEqualTo(id);
  }

  @Test
  void wordsWithoutFinishedDetailsAreCountedButNotOffered() throws Exception {
    String token = token("study-unavailable@example.com", 10);
    long waiting = add(token, "details not ready");
    long ready = add(token, "details ready");
    jdbc.update(
        "UPDATE vocabulary_items SET enrichment_status = 'PENDING' WHERE normalized_term = ?",
        "details not ready");

    JsonNode queue = queue(token, DAY_ONE);

    assertThat(queue.path("unavailableCount").asInt()).isEqualTo(1);
    assertThat(queue.path("newCount").asInt()).isEqualTo(1);
    assertThat(queue.path("nextCard").path("userVocabularyId").asLong()).isEqualTo(ready);
    assertThat(waiting).isNotEqualTo(ready);
  }

  private JsonNode option(JsonNode card, String rating) {
    List<JsonNode> found = new ArrayList<>();
    card.path("options")
        .forEach(
            option -> {
              if (option.path("rating").asText().equals(rating)) {
                found.add(option);
              }
            });
    assertThat(found).hasSize(1);
    return found.getFirst();
  }

  private String learningStatus(String token, long id) throws Exception {
    return read(get("/api/v1/vocabulary/" + id), token).path("learningStatus").asText();
  }

  private JsonNode queue(String token, LocalDate date) throws Exception {
    return read(get("/api/v1/learning/study-queue").queryParam("date", date.toString()), token);
  }

  private JsonNode plan(String token, LocalDate date) throws Exception {
    return read(get("/api/v1/learning/daily-plan").queryParam("date", date.toString()), token);
  }

  private JsonNode read(
      org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request,
      String token)
      throws Exception {
    return json.readTree(
        mvc.perform(request.header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString());
  }

  private JsonNode review(String token, long id, String rating, int version, LocalDate date)
      throws Exception {
    return json.readTree(
        postReview(token, id, rating, version, date)
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString());
  }

  private ResultActions postReview(
      String token, long id, String rating, int version, LocalDate date) throws Exception {
    return mvc.perform(
        post("/api/v1/learning/cards/" + id + "/reviews")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(
                "{\"rating\":\""
                    + rating
                    + "\",\"version\":"
                    + version
                    + ",\"date\":\""
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

  private String token(String email, int goal) throws Exception {
    mvc.perform(
            post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"email\":\""
                        + email
                        + "\",\"password\":\"password123\",\"clbLevel\":\"CLB_5\",\"dailyNewVocabularyGoal\":"
                        + goal
                        + "}"))
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
