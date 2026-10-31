package com.vocabflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.*;
import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class VocabularyApiTests {
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;

  String token(String email) throws Exception {
    String v =
        mvc.perform(
                post("/api/v1/auth/register")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        "{\"email\":\""
                            + email
                            + "\",\"password\":\"password123\",\"clbLevel\":\"CLB_5\",\"dailyNewVocabularyGoal\":10}"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return json.readTree(
            mvc.perform(
                    post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"password123\"}"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString())
        .get("accessToken")
        .asText();
  }

  @Test
  @Order(1)
  void protectedEndpointRejected() throws Exception {
    mvc.perform(get("/api/v1/vocabulary"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
  }

  @ParameterizedTest
  @ValueSource(strings = {"Basic credentials", "Bearer ", "Bearer invalid.token"})
  void malformedAuthorizationHeaderIsRejected(String authorization) throws Exception {
    mvc.perform(get("/api/v1/vocabulary").header("Authorization", authorization))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
  }

  @Test
  void invalidRegistrationInputReturnsBadRequest() throws Exception {
    String body =
        mvc.perform(
                post("/api/v1/auth/register")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        "{\"email\":\"not-an-email\",\"password\":\"password123\",\"clbLevel\":\"CLB_5\",\"dailyNewVocabularyGoal\":10}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
            .andReturn()
            .getResponse()
            .getContentAsString();
    assertApiErrorSchema(body);
    mvc.perform(
            post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"email\":\"invalid-clb@example.com\",\"password\":\"password123\",\"clbLevel\":\"CLB_99\",\"dailyNewVocabularyGoal\":10}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    mvc.perform(
            post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"email\":\"invalid-goal@example.com\",\"password\":\"password123\",\"clbLevel\":\"CLB_5\",\"dailyNewVocabularyGoal\":0}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
  }

  @Test
  @Order(2)
  void createListDuplicateAndIsolation() throws Exception {
    String a = token("a@example.com"), b = token("b@example.com");
    String body =
        mvc.perform(
                post("/api/v1/vocabulary")
                    .header("Authorization", "Bearer " + a)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"term\":\"overwhelmed\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.enrichmentStatus").value("PENDING"))
            .andReturn()
            .getResponse()
            .getContentAsString();
    long id = json.readTree(body).get("id").asLong();
    // Enrichment runs in the background (inline under the test profile), so it shows up on reads.
    mvc.perform(get("/api/v1/vocabulary/" + id).header("Authorization", "Bearer " + a))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.enrichmentStatus").value("COMPLETED"))
        .andExpect(jsonPath("$.failureReason").isEmpty())
        .andExpect(jsonPath("$.definition").isNotEmpty());
    mvc.perform(
            post("/api/v1/vocabulary")
                .header("Authorization", "Bearer " + a)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"term\":\" Overwhelmed \"}"))
        .andExpect(status().isConflict());
    mvc.perform(get("/api/v1/vocabulary").header("Authorization", "Bearer " + a))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(1));
    mvc.perform(get("/api/v1/vocabulary/" + id).header("Authorization", "Bearer " + b))
        .andExpect(status().isNotFound());
  }

  @Test
  void returnsEachMeaningOfAWordAndASingleOneForWordsWithoutAny() throws Exception {
    String token = token("senses@example.com");
    long resume = add(token, "resume");
    long other = add(token, "something plain");

    mvc.perform(get("/api/v1/vocabulary/" + resume).header("Authorization", "Bearer " + token))
        .andExpect(jsonPath("$.senses.length()").value(2))
        .andExpect(jsonPath("$.senses[0].label").value("document"))
        .andExpect(jsonPath("$.senses[1].partOfSpeech").value("verb"))
        .andExpect(jsonPath("$.senses[1].phonetic").value("/rɪˈzuːm/"))
        .andExpect(jsonPath("$.definition").value(org.hamcrest.Matchers.startsWith("A short")));
    mvc.perform(get("/api/v1/vocabulary/" + other).header("Authorization", "Bearer " + token))
        .andExpect(jsonPath("$.senses.length()").value(1));

    jdbc.update(
        "UPDATE vocabulary_items SET senses_json = NULL WHERE normalized_term = ?",
        "something plain");
    mvc.perform(get("/api/v1/vocabulary/" + other).header("Authorization", "Bearer " + token))
        .andExpect(jsonPath("$.senses.length()").value(1))
        .andExpect(jsonPath("$.senses[0].label").isEmpty())
        .andExpect(jsonPath("$.senses[0].definition").isNotEmpty());
    mvc.perform(
            get("/api/v1/learning/study-queue?date=2026-12-20")
                .header("Authorization", "Bearer " + token))
        .andExpect(jsonPath("$.nextCard.term").value("resume"))
        .andExpect(jsonPath("$.nextCard.senses.length()").value(2));
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
        .get("id")
        .asLong();
  }

  private void assertApiErrorSchema(String body) throws Exception {
    Set<String> fields = new HashSet<>();
    json.readTree(body).fieldNames().forEachRemaining(fields::add);

    assertThat(fields).containsExactlyInAnyOrder("code", "message", "timestamp");
  }
}
