package com.vocabflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
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
class ReadingApiTests {
  private static final LocalDate DAY = LocalDate.of(2026, 12, 3);

  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;

  @Test
  void writesOnePassageForADayWhoseStudyEndedFromAtMostFifteenWordsAndKeepsTrackOfReading()
      throws Exception {
    String token = token("reading-flow@example.com", 17);
    finishDayWith(token, 17);

    JsonNode passage = generate(token);

    assertThat(passage.path("words")).hasSize(15);
    assertThat(passage.path("title").asText()).isEqualTo("Practice reading (level 4)");
    assertThat(passage.path("text").asText()).contains("[[");
    assertThat(passage.path("studyDate").asText()).isEqualTo(DAY.toString());
    assertThat(passage.path("read").asBoolean()).isFalse();
    long id = passage.path("id").asLong();
    // Asking again for the same day returns that passage.
    assertThat(generate(token).path("id").asLong()).isEqualTo(id);
    mvc.perform(get("/api/v1/reading/today").param("date", DAY.toString()).headers(auth(token)))
        .andExpect(jsonPath("$.passageId").value(id));
    mvc.perform(
            get("/api/v1/reading/today")
                .param("date", DAY.plusDays(1).toString())
                .headers(auth(token)))
        .andExpect(jsonPath("$.passageId").isEmpty());

    assertThat(list(token, null).path("totalElements").asInt()).isEqualTo(1);
    assertThat(list(token, "true").path("totalElements").asInt()).isZero();
    assertThat(list(token, "false").path("totalElements").asInt()).isEqualTo(1);
    assertThat(list(token, null).path("content").get(0).path("wordCount").asInt()).isEqualTo(15);

    mvc.perform(
            put("/api/v1/reading/passages/" + id + "/read")
                .headers(auth(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"read\":true}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.read").value(true))
        .andExpect(jsonPath("$.readAt").isNotEmpty());
    assertThat(list(token, "true").path("totalElements").asInt()).isEqualTo(1);
    assertThat(list(token, "false").path("totalElements").asInt()).isZero();

    mvc.perform(
            put("/api/v1/reading/passages/" + id + "/read")
                .headers(auth(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"read\":false}"))
        .andExpect(jsonPath("$.read").value(false))
        .andExpect(jsonPath("$.readAt").isEmpty());
  }

  @Test
  void refusesUntilTheDaysStudyHasEnded() throws Exception {
    String token = token("reading-open@example.com", 12);
    for (int i = 0; i < 12; i++) {
      add(token, "open word " + i);
    }
    queue(token);

    mvc.perform(
            post("/api/v1/reading/passages")
                .headers(auth(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body()))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.message").value("Finish today's study before writing a passage"));
  }

  @Test
  void saysHowManyWordsWereStudiedWhenThereAreTooFewAndAllowsAnotherTryLater() throws Exception {
    String token = token("reading-few@example.com", 12);
    finishDayWith(token, 3);

    mvc.perform(
            post("/api/v1/reading/passages")
                .headers(auth(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body()))
        .andExpect(status().isConflict())
        .andExpect(
            jsonPath("$.message")
                .value("You studied 3 words or phrases today. A passage needs at least 10."));
    mvc.perform(get("/api/v1/reading/today").param("date", DAY.toString()).headers(auth(token)))
        .andExpect(jsonPath("$.passageId").isEmpty());
  }

  @Test
  void aPassageBelongsToItsReaderAndTheEndpointsNeedASignIn() throws Exception {
    String owner = token("reading-owner@example.com", 10);
    String other = token("reading-other@example.com", 10);
    finishDayWith(owner, 10);
    long id = generate(owner).path("id").asLong();

    mvc.perform(get("/api/v1/reading/passages/" + id).headers(auth(other)))
        .andExpect(status().isNotFound());
    mvc.perform(
            put("/api/v1/reading/passages/" + id + "/read")
                .headers(auth(other))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"read\":true}"))
        .andExpect(status().isNotFound());
    assertThat(list(other, null).path("totalElements").asInt()).isZero();
    mvc.perform(get("/api/v1/reading/passages")).andExpect(status().isUnauthorized());
    mvc.perform(
            post("/api/v1/reading/passages")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body()))
        .andExpect(status().isUnauthorized());
    mvc.perform(
            post("/api/v1/reading/passages")
                .headers(auth(owner))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
        .andExpect(status().isBadRequest());
  }

  private void finishDayWith(String token, int words) throws Exception {
    for (int i = 0; i < words; i++) {
      add(token, "reading word " + i);
    }
    JsonNode queue = queue(token);
    while (!queue.path("nextCard").isNull()) {
      JsonNode card = queue.path("nextCard");
      queue = review(token, card.path("userVocabularyId").asLong(), card.path("version").asInt());
    }
    assertThat(queue.path("finished").asBoolean()).isTrue();
  }

  private JsonNode generate(String token) throws Exception {
    return json.readTree(
        mvc.perform(
                post("/api/v1/reading/passages")
                    .headers(auth(token))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body()))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString());
  }

  private JsonNode list(String token, String read) throws Exception {
    var request = get("/api/v1/reading/passages").headers(auth(token));
    if (read != null) {
      request = request.param("read", read);
    }
    return json.readTree(
        mvc.perform(request)
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString());
  }

  private String body() {
    return "{\"date\":\"" + DAY + "\"}";
  }

  private static org.springframework.http.HttpHeaders auth(String token) {
    org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
    headers.setBearerAuth(token);
    return headers;
  }

  private JsonNode queue(String token) throws Exception {
    return json.readTree(
        mvc.perform(
                get("/api/v1/learning/study-queue")
                    .param("date", DAY.toString())
                    .headers(auth(token)))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString());
  }

  private JsonNode review(String token, long id, int version) throws Exception {
    return json.readTree(
        mvc.perform(
                post("/api/v1/learning/cards/" + id + "/reviews")
                    .headers(auth(token))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        "{\"rating\":\"EASY\",\"version\":"
                            + version
                            + ",\"date\":\""
                            + DAY
                            + "\"}"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString());
  }

  private long add(String token, String term) throws Exception {
    return json.readTree(
            mvc.perform(
                    post("/api/v1/vocabulary")
                        .headers(auth(token))
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
