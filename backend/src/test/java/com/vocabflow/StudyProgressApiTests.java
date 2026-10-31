package com.vocabflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
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
class StudyProgressApiTests {
  private static final LocalDate DAY = LocalDate.of(2026, 12, 1);

  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired JdbcTemplate jdbc;

  @Test
  void wordsAddedBeforeTheGoalIsFullJoinTodaysPlanInOrder() throws Exception {
    String token = token("progress-join@example.com", 3);
    long first = add(token, "join first");
    assertThat(planNewIds(token)).containsExactly(first);

    long second = add(token, "join second");
    long third = add(token, "join third");
    long fourth = add(token, "join fourth");

    assertThat(planNewIds(token)).containsExactly(first, second, third);
    assertThat(queue(token).path("newTargetCount").asInt()).isEqualTo(3);
    assertThat(queue(token).path("moreNewWords").asBoolean()).isTrue();
    assertThat(fourth).isNotZero();
  }

  @Test
  void wordsAddedHalfwayThroughStudyingJoinToo() throws Exception {
    String token = token("progress-halfway@example.com", 3);
    long first = add(token, "halfway first");
    long second = add(token, "halfway second");
    queue(token);
    review(token, first);

    long third = add(token, "halfway third");

    JsonNode queue = queue(token);
    assertThat(planNewIds(token)).containsExactly(first, second, third);
    assertThat(queue.path("studiedCount").asInt()).isEqualTo(1);
    assertThat(queue.path("notStartedCount").asInt()).isEqualTo(2);
    assertThat(queue.path("finished").asBoolean()).isFalse();
  }

  @Test
  void finishingEndsTheDaySoLaterWordsWaitUntilAskedOrTheNextDay() throws Exception {
    String token = token("progress-finish@example.com", 5);
    long first = add(token, "finish first");
    queue(token);

    JsonNode finished = review(token, first);

    assertThat(finished.path("finished").asBoolean()).isTrue();
    assertThat(finished.path("nextCard").isNull()).isTrue();
    assertThat(finished.path("studiedCount").asInt()).isEqualTo(1);
    assertThat(finished.path("newTargetCount").asInt()).isEqualTo(5);
    assertThat(finished.path("goalShortfall").asInt()).as("only 1 of 5 exists").isEqualTo(4);
    assertThat(finished.path("moreNewWords").asBoolean()).isFalse();
    JsonNode studied = finished.path("studiedToday").get(0);
    assertThat(studied.path("userVocabularyId").asLong()).isEqualTo(first);
    assertThat(studied.path("term").asText()).isEqualTo("finish first");
    assertThat(studied.path("learningStatus").asText()).isEqualTo("FAMILIAR");

    long later = add(token, "finish later");

    JsonNode afterAdding = queue(token);
    assertThat(afterAdding.path("finished").asBoolean()).isTrue();
    assertThat(afterAdding.path("nextCard").isNull()).isTrue();
    assertThat(afterAdding.path("moreNewWords").asBoolean()).isTrue();
    assertThat(planNewIds(token)).containsExactly(first);

    assertThat(idsOf(plan(token, DAY.plusDays(1)))).containsExactly(later);
  }

  @Test
  void aLearningStepStillToComeIsNotTheEndOfTheDay() throws Exception {
    String token = token("progress-step@example.com", 5);
    long first = add(token, "step first");
    queue(token);

    JsonNode queue = reviewAs(token, first, "GOOD", 0);
    assertThat(queue.path("finished").asBoolean()).isFalse();
    assertThat(queue.path("nextCard").path("state").asText()).isEqualTo("LEARNING");

    jdbc.update(
        "UPDATE learning_cards SET due_at = TIMESTAMPADD(HOUR, 5, due_at) WHERE user_vocabulary_id = ?",
        first);
    JsonNode waiting = queue(token);
    assertThat(waiting.path("nextCard").isNull()).isTrue();
    assertThat(waiting.path("finished").asBoolean()).isFalse();
    long added = add(token, "step added");
    assertThat(planNewIds(token)).containsExactly(first, added);
  }

  @Test
  void ratingTheLastDueCardWhileAStepIsStillToComeDoesNotFinishTheDay() throws Exception {
    String token = token("progress-last-due@example.com", 5);
    long stepping = add(token, "last due stepping");
    long other = add(token, "last due other");
    queue(token);
    reviewAs(token, stepping, "GOOD", 0);
    jdbc.update(
        "UPDATE learning_cards SET due_at = TIMESTAMPADD(HOUR, 5, due_at) WHERE user_vocabulary_id = ?",
        stepping);

    JsonNode queue = review(token, other);

    assertThat(queue.path("nextCard").isNull()).isTrue();
    assertThat(queue.path("nextDueAt").isNull()).isFalse();
    assertThat(queue.path("finished").asBoolean()).isFalse();
  }

  @Test
  void anotherBatchFirstFillsTheGoalThenAddsAWholeGoalMore() throws Exception {
    String token = token("progress-batch@example.com", 2);
    long first = add(token, "batch one");
    queue(token);
    review(token, first);

    long second = add(token, "batch two");
    long third = add(token, "batch three");
    long fourth = add(token, "batch four");
    long fifth = add(token, "batch five");

    JsonNode filled = more(token);
    assertThat(filled.path("finished").asBoolean()).as("the day is open again").isFalse();
    assertThat(filled.path("newTargetCount").asInt()).isEqualTo(2);
    assertThat(filled.path("nextCard").path("userVocabularyId").asLong()).isEqualTo(second);
    assertThat(planNewIds(token)).containsExactly(first, second);

    JsonNode finishedAgain = review(token, second);
    assertThat(finishedAgain.path("finished").asBoolean()).isTrue();

    JsonNode batch = more(token);
    assertThat(batch.path("newTargetCount").asInt()).isEqualTo(4);
    assertThat(batch.path("studiedCount").asInt()).isEqualTo(2);
    assertThat(batch.path("notStartedCount").asInt()).as("the total grew").isEqualTo(2);
    assertThat(planNewIds(token)).containsExactly(first, second, third, fourth);
    assertThat(fifth).isNotZero();
  }

  @Test
  void askingForMoreWithNoNewWordsLeavesTheDayFinished() throws Exception {
    String token = token("progress-nomore@example.com", 2);
    long first = add(token, "nomore first");
    queue(token);
    review(token, first);

    JsonNode queue = more(token);

    assertThat(queue.path("finished").asBoolean()).isTrue();
    assertThat(queue.path("newTargetCount").asInt()).isEqualTo(2);
  }

  @Test
  void everyWordIsInExactlyOneGroupThroughoutAStudy() throws Exception {
    String token = token("progress-groups@example.com", 3);
    long first = add(token, "groups first");
    long second = add(token, "groups second");
    long third = add(token, "groups third");

    assertGroups(queue(token), 0, 0, 3);

    assertGroups(reviewAs(token, first, "AGAIN", 0), 0, 1, 2);
    assertGroups(reviewAs(token, second, "GOOD", 0), 0, 2, 1);
    assertGroups(review(token, third), 1, 2, 0);
    assertGroups(reviewAs(token, second, "GOOD", 1), 2, 1, 0);
    assertGroups(reviewAs(token, first, "AGAIN", 1), 2, 1, 0);
    JsonNode finished = reviewAs(token, first, "EASY", 2);
    assertGroups(finished, 3, 0, 0);
    assertThat(finished.path("finished").asBoolean()).isTrue();
  }

  @Test
  void aReviewCountsLikeAnyOtherWordAndGoesBackToLearningIfForgotten() throws Exception {
    String token = token("progress-reviews@example.com", 5);
    long first = add(token, "reviews first");
    long second = add(token, "reviews second");
    queue(token);
    review(token, first);
    review(token, second);

    String later = "2026-12-05";
    JsonNode due = read(get("/api/v1/learning/study-queue").queryParam("date", later), token);
    assertGroups(due, 0, 0, 2);

    JsonNode forgotten = reviewOn(token, first, "AGAIN", 1, later);
    assertGroups(forgotten, 0, 1, 1);
    JsonNode remembered = reviewOn(token, second, "GOOD", 1, later);
    assertGroups(remembered, 1, 1, 0);
    assertGroups(reviewOn(token, first, "GOOD", 2, later), 2, 0, 0);
  }

  @Test
  void wordsWithoutFinishedDetailsAreLeftOutOfTheGroups() throws Exception {
    String token = token("progress-details@example.com", 5);
    add(token, "details waiting term");
    add(token, "details ready term");
    jdbc.update(
        "UPDATE vocabulary_items SET enrichment_status = 'FAILED' WHERE normalized_term = ?",
        "details waiting term");

    JsonNode queue = queue(token);

    assertGroups(queue, 0, 0, 1);
    assertThat(queue.path("unavailableCount").asInt()).isEqualTo(1);
  }

  private void assertGroups(JsonNode queue, int studied, int learning, int notStarted) {
    assertThat(queue.path("studiedCount").asInt()).as("studied").isEqualTo(studied);
    assertThat(queue.path("stillLearningCount").asInt()).as("learning").isEqualTo(learning);
    assertThat(queue.path("notStartedCount").asInt()).as("not started").isEqualTo(notStarted);
  }

  private JsonNode reviewOn(String token, long id, String rating, int version, String date)
      throws Exception {
    return json.readTree(
        mvc.perform(
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
                            + "\"}"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString());
  }

  @Test
  void moreRequiresSignInAndADate() throws Exception {
    mvc.perform(
            post("/api/v1/learning/study-queue/more")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"date\":\"2026-12-01\"}"))
        .andExpect(status().isUnauthorized());
    mvc.perform(
            post("/api/v1/learning/study-queue/more")
                .header("Authorization", "Bearer " + token("progress-more-date@example.com", 2))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
  }

  @Test
  void anotherUsersWordsNeverJoinThePlan() throws Exception {
    String owner = token("progress-owner@example.com", 5);
    String other = token("progress-other@example.com", 5);
    long mine = add(owner, "owner word");
    queue(owner);
    add(other, "other word");

    assertThat(planNewIds(owner)).containsExactly(mine);
  }

  private List<Long> planNewIds(String token) throws Exception {
    return idsOf(plan(token, DAY));
  }

  private List<Long> idsOf(JsonNode plan) {
    List<Long> ids = new ArrayList<>();
    plan.path("newItems").forEach(item -> ids.add(item.path("userVocabularyId").asLong()));
    return ids;
  }

  private JsonNode plan(String token, LocalDate date) throws Exception {
    return read(get("/api/v1/learning/daily-plan").queryParam("date", date.toString()), token);
  }

  private JsonNode queue(String token) throws Exception {
    return read(get("/api/v1/learning/study-queue").queryParam("date", DAY.toString()), token);
  }

  private JsonNode more(String token) throws Exception {
    return json.readTree(
        mvc.perform(
                post("/api/v1/learning/study-queue/more")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"date\":\"" + DAY + "\"}"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString());
  }

  private JsonNode review(String token, long id) throws Exception {
    return reviewAs(token, id, "EASY", 0);
  }

  private JsonNode reviewAs(String token, long id, String rating, int version) throws Exception {
    return json.readTree(
        mvc.perform(
                post("/api/v1/learning/cards/" + id + "/reviews")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        "{\"rating\":\""
                            + rating
                            + "\",\"version\":"
                            + version
                            + ",\"date\":\""
                            + DAY
                            + "\"}"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString());
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
