package com.vocabflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
class DailyLearningPlanApiTests {
  @Autowired private MockMvc mvc;
  @Autowired private ObjectMapper json;

  @Test
  void requiresAuthenticationAndReturnsStableUserScopedPlans() throws Exception {
    mvc.perform(get("/api/v1/learning/daily-plan")).andExpect(status().isUnauthorized());

    String firstToken = token("daily-plan-first@example.com", 2);
    addVocabulary(firstToken, "first plan term");
    addVocabulary(firstToken, "second plan term");
    addVocabulary(firstToken, "third plan term");

    JsonNode firstPlan = plan(firstToken, "2026-08-25");
    JsonNode repeatedPlan = plan(firstToken, "2026-08-25");
    assertThat(firstPlan).isEqualTo(repeatedPlan);
    assertThat(firstPlan.path("date").asText()).isEqualTo("2026-08-25");
    assertThat(firstPlan.path("newVocabularyGoal").asInt()).isEqualTo(2);
    assertThat(firstPlan.path("newItems")).hasSize(2);
    assertThat(firstPlan.path("reviewItems")).isEmpty();

    JsonNode nextDatePlan = plan(firstToken, "2026-08-26");
    assertThat(nextDatePlan.path("date").asText()).isEqualTo("2026-08-26");

    String secondToken = token("daily-plan-second@example.com", 2);
    addVocabulary(secondToken, "second user term");
    JsonNode secondPlan = plan(secondToken, "2026-08-25");
    assertThat(secondPlan.path("newItems")).hasSize(1);
    assertThat(secondPlan.path("newItems").get(0).path("term").asText())
        .isEqualTo("second user term");

    mvc.perform(get("/api/v1/learning/daily-plan").header("Authorization", "Bearer " + firstToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.date").isString());
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
    String response =
        mvc.perform(
                post("/api/v1/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"" + email + "\",\"password\":\"password123\"}"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return json.readTree(response).path("accessToken").asText();
  }

  private void addVocabulary(String token, String term) throws Exception {
    mvc.perform(
            post("/api/v1/vocabulary")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"term\":\"" + term + "\"}"))
        .andExpect(status().isOk());
  }

  private JsonNode plan(String token, String date) throws Exception {
    String response =
        mvc.perform(
                get("/api/v1/learning/daily-plan")
                    .queryParam("date", date)
                    .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return json.readTree(response);
  }
}
