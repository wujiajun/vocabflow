package com.vocabflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SettingsAndFilterApiTests {
  private static final String DAY = "2026-12-01";
  private static final String FOUR_DAYS_LATER = "2026-12-05";

  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;

  @Test
  void theDailyGoalCanBeChangedAndIsKept() throws Exception {
    String token = token("settings-goal@example.com", 10);

    mvc.perform(setGoal(token, "25"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.dailyNewVocabularyGoal").value(25))
        .andExpect(jsonPath("$.email").value("settings-goal@example.com"));

    mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + token))
        .andExpect(jsonPath("$.dailyNewVocabularyGoal").value(25))
        .andExpect(jsonPath("$.clbLevel").value("CLB_5"));
    mvc.perform(
            post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"settings-goal@example.com\",\"password\":\"password123\"}"))
        .andExpect(status().isOk());
  }

  @Test
  void anInvalidGoalIsRefusedAndChangesNothing() throws Exception {
    String token = token("settings-invalid@example.com", 10);
    for (String value : List.of("0", "101", "null")) {
      mvc.perform(setGoal(token, value))
          .andExpect(status().isBadRequest())
          .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }
    mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + token))
        .andExpect(jsonPath("$.dailyNewVocabularyGoal").value(10));
  }

  @Test
  void changingTheGoalNeedsSignInAndAffectsOnlyThatUser() throws Exception {
    mvc.perform(
            patch("/api/v1/auth/me")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"dailyNewVocabularyGoal\":5}"))
        .andExpect(status().isUnauthorized());
    String mine = token("settings-mine@example.com", 10);
    String other = token("settings-other@example.com", 10);

    mvc.perform(setGoal(mine, "5")).andExpect(status().isOk());

    mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + other))
        .andExpect(jsonPath("$.dailyNewVocabularyGoal").value(10));
  }

  @Test
  void theClbLevelCanBeChangedOnItsOwnOrWithTheGoalAndLeavesTheRestAlone() throws Exception {
    String token = token("settings-clb@example.com", 7);

    mvc.perform(patchBody(token, "{\"clbLevel\":\"CLB_8\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.clbLevel").value("CLB_8"))
        .andExpect(jsonPath("$.dailyNewVocabularyGoal").value(7));
    mvc.perform(patchBody(token, "{\"dailyNewVocabularyGoal\":9}"))
        .andExpect(jsonPath("$.clbLevel").value("CLB_8"))
        .andExpect(jsonPath("$.dailyNewVocabularyGoal").value(9));
    mvc.perform(patchBody(token, "{\"clbLevel\":\"clb-3\",\"dailyNewVocabularyGoal\":4}"))
        .andExpect(jsonPath("$.clbLevel").value("CLB_3"))
        .andExpect(jsonPath("$.dailyNewVocabularyGoal").value(4));
    mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + token))
        .andExpect(jsonPath("$.clbLevel").value("CLB_3"));
  }

  @Test
  void refusesAnUnknownClbLevelAndAnEmptyChange() throws Exception {
    String token = token("settings-clb-bad@example.com", 7);

    mvc.perform(patchBody(token, "{\"clbLevel\":\"CLB_13\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.message").value("CLB level must be CLB_1 through CLB_12"));
    mvc.perform(patchBody(token, "{}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.message").value("Give a daily goal or a CLB level"));
    mvc.perform(patchBody(token, "{\"dailyNewVocabularyGoal\":0}"))
        .andExpect(status().isBadRequest());
    mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + token))
        .andExpect(jsonPath("$.clbLevel").value("CLB_5"));
  }

  @Test
  void raisingTheGoalFillsTodayAndLoweringItRemovesNothing() throws Exception {
    String token = token("settings-plan@example.com", 1);
    long first = add(token, "goal plan first");
    long second = add(token, "goal plan second");
    assertThat(planIds(token)).containsExactly(first);

    mvc.perform(setGoal(token, "2")).andExpect(status().isOk());
    assertThat(planIds(token)).containsExactly(first, second);

    mvc.perform(setGoal(token, "1")).andExpect(status().isOk());
    assertThat(planIds(token)).containsExactly(first, second);
    assertThat(queue(token).path("newTargetCount").asInt())
        .as("never below what is planned")
        .isEqualTo(2);
  }

  @Test
  void raisingTheGoalDoesNotReopenAFinishedDay() throws Exception {
    String token = token("settings-finished@example.com", 1);
    long first = add(token, "finished first");
    add(token, "finished second");
    queue(token);
    review(token, first, "EASY", 0, DAY);

    mvc.perform(setGoal(token, "2")).andExpect(status().isOk());

    assertThat(planIds(token)).containsExactly(first);
    assertThat(queue(token).path("finished").asBoolean()).isTrue();
  }

  @Test
  void theListFiltersByStatusNewestFirst() throws Exception {
    String token = token("filter-status@example.com", 10);
    long fresh = add(token, "status fresh");
    long learning = add(token, "status learning");
    long familiar = add(token, "status familiar");
    long otherFresh = add(token, "status other fresh");
    queue(token);
    review(token, learning, "AGAIN", 0, DAY);
    review(token, familiar, "EASY", 0, DAY);

    assertThat(ids(list(token, "status=NEW"))).containsExactly(otherFresh, fresh);
    assertThat(ids(list(token, "status=LEARNING"))).containsExactly(learning);
    assertThat(ids(list(token, "status=FAMILIAR"))).containsExactly(familiar);
    assertThat(ids(list(token, "status=MASTERED"))).isEmpty();
    assertThat(ids(list(token, ""))).hasSize(4);
  }

  @Test
  void theListFiltersWordsDueByADay() throws Exception {
    String token = token("filter-due@example.com", 10);
    add(token, "due untouched");
    long stepping = add(token, "due stepping");
    long review = add(token, "due review");
    queue(token);
    review(token, stepping, "AGAIN", 0, DAY);
    review(token, review, "EASY", 0, DAY);

    assertThat(ids(list(token, "due=" + DAY))).as("not yet due").containsExactly(stepping);
    assertThat(ids(list(token, "due=" + FOUR_DAYS_LATER))).containsExactly(review, stepping);
    assertThat(ids(list(token, "due=" + FOUR_DAYS_LATER + "&status=FAMILIAR")))
        .containsExactly(review);
  }

  @Test
  void filteredListsPageAndStayWithinTheUser() throws Exception {
    String token = token("filter-page@example.com", 10);
    String other = token("filter-page-other@example.com", 10);
    long first = add(token, "page first");
    long second = add(token, "page second");
    long third = add(token, "page third");
    add(other, "page other user");

    JsonNode page = list(token, "status=NEW&size=2&page=1");
    assertThat(ids(page)).containsExactly(first);
    assertThat(page.path("totalElements").asInt()).isEqualTo(3);
    assertThat(page.path("totalPages").asInt()).isEqualTo(2);
    assertThat(ids(list(token, "status=NEW&size=2"))).containsExactly(third, second);

    JsonNode noDue = list(token, "due=" + DAY);
    assertThat(noDue.path("totalElements").asInt()).isZero();
    assertThat(noDue.path("content")).isEmpty();
  }

  @Test
  void invalidFiltersAreRefused() throws Exception {
    String token = token("filter-invalid@example.com", 10);
    for (String query : List.of("status=DONE", "due=soon")) {
      mvc.perform(get("/api/v1/vocabulary?" + query).header("Authorization", "Bearer " + token))
          .andExpect(status().isBadRequest())
          .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
    }
  }

  private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder setGoal(
      String token, String value) {
    return patch("/api/v1/auth/me")
        .header("Authorization", "Bearer " + token)
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"dailyNewVocabularyGoal\":" + value + "}");
  }

  private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder patchBody(
      String token, String body) {
    return patch("/api/v1/auth/me")
        .header("Authorization", "Bearer " + token)
        .contentType(MediaType.APPLICATION_JSON)
        .content(body);
  }

  private List<Long> ids(JsonNode page) {
    List<Long> ids = new ArrayList<>();
    page.path("content").forEach(item -> ids.add(item.path("id").asLong()));
    return ids;
  }

  private List<Long> planIds(String token) throws Exception {
    List<Long> ids = new ArrayList<>();
    read("/api/v1/learning/daily-plan?date=" + DAY, token)
        .path("newItems")
        .forEach(item -> ids.add(item.path("userVocabularyId").asLong()));
    return ids;
  }

  private JsonNode list(String token, String query) throws Exception {
    return read("/api/v1/vocabulary?" + query, token);
  }

  private JsonNode queue(String token) throws Exception {
    return read("/api/v1/learning/study-queue?date=" + DAY, token);
  }

  private JsonNode read(String url, String token) throws Exception {
    return json.readTree(
        mvc.perform(get(url).header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString());
  }

  private void review(String token, long id, String rating, int version, String date)
      throws Exception {
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
        .andExpect(status().isOk());
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
