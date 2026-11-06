package com.vocabflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vocabflow.vocabulary.domain.SourceContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/** The sentence a word was tapped in: saved per user, returned, first one kept. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class VocabularySourceApiTests {
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;

  @Test
  void sentenceIsSavedReturnedAndTheFirstOneKept() throws Exception {
    String token = token("source-a@example.com");
    JsonNode created =
        add(
            token,
            "{\"term\":\"harvest1\",\"sentence\":\"  The farmers   harvest1 the\\n crop in autumn. \","
                + "\"form\":\"harvest1\",\"sourceTitle\":\"A day on the farm\","
                + "\"sourceLink\":\"/app/reading/12\"}");
    JsonNode source = created.get("source");
    assertThat(source.get("sentence").asText())
        .isEqualTo("The farmers harvest1 the crop in autumn.");
    assertThat(source.get("form").asText()).isEqualTo("harvest1");
    assertThat(source.get("title").asText()).isEqualTo("A day on the farm");
    assertThat(source.get("link").asText()).isEqualTo("/app/reading/12");

    mvc.perform(
            get("/api/v1/vocabulary/" + created.get("id").asLong())
                .header("Authorization", "Bearer " + token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.source.sentence").value("The farmers harvest1 the crop in autumn."));

    // The word is already there: refused, and the stored sentence is untouched.
    mvc.perform(
            post("/api/v1/vocabulary")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"term\":\"harvest1\",\"sentence\":\"A different sentence.\"}"))
        .andExpect(status().isConflict());
    mvc.perform(
            get("/api/v1/vocabulary/" + created.get("id").asLong())
                .header("Authorization", "Bearer " + token))
        .andExpect(jsonPath("$.source.sentence").value("The farmers harvest1 the crop in autumn."));
  }

  @Test
  void aTypedWordHasNoSource() throws Exception {
    String token = token("source-b@example.com");
    JsonNode created = add(token, "{\"term\":\"typed1\"}");
    assertThat(created.get("source").isNull()).isTrue();
    JsonNode blank = add(token, "{\"term\":\"typed2\",\"sentence\":\"   \",\"form\":\"typed2\"}");
    assertThat(blank.get("source").isNull()).isTrue();
  }

  @Test
  void anotherUserNeverSeesTheSentence() throws Exception {
    String owner = token("source-c@example.com");
    String other = token("source-d@example.com");
    JsonNode mine =
        add(owner, "{\"term\":\"shared1\",\"sentence\":\"My private shared1 sentence.\"}");
    JsonNode theirs = add(other, "{\"term\":\"shared1\"}");

    assertThat(theirs.get("source").isNull()).isTrue();
    assertThat(theirs.get("id").asLong()).isNotEqualTo(mine.get("id").asLong());
    mvc.perform(
            get("/api/v1/vocabulary/" + mine.get("id").asLong())
                .header("Authorization", "Bearer " + other))
        .andExpect(status().isNotFound());
    mvc.perform(get("/api/v1/vocabulary").header("Authorization", "Bearer " + other))
        .andExpect(jsonPath("$.content[0].source").doesNotExist());
  }

  @Test
  void aLongSentenceIsCutAtAWordWithinTheLimit() throws Exception {
    String token = token("source-e@example.com");
    String sentence = "word ".repeat(100).trim();
    JsonNode created =
        add(token, "{\"term\":\"long1\",\"sentence\":\"" + sentence + "\",\"form\":\"long1\"}");
    String stored = created.get("source").get("sentence").asText();
    assertThat(stored.length()).isLessThanOrEqualTo(SourceContext.MAX_SENTENCE);
    assertThat(stored).endsWith("word…");
  }

  @Test
  void aLinkThatIsNotAnInAppPathIsRefused() throws Exception {
    String token = token("source-f@example.com");
    for (String link :
        new String[] {
          "https://evil.example.com/app/x",
          "//evil.example.com",
          "/other/place",
          "javascript:alert(1)",
          "/app/../secret",
          "/app//evil.com"
        }) {
      mvc.perform(
              post("/api/v1/vocabulary")
                  .header("Authorization", "Bearer " + token)
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(
                      "{\"term\":\"link1\",\"sentence\":\"A link1 here.\",\"sourceLink\":\""
                          + link
                          + "\"}"))
          .andExpect(status().isBadRequest())
          .andExpect(jsonPath("$.code").exists());
    }
    // Nothing was saved by the refusals.
    mvc.perform(get("/api/v1/vocabulary").header("Authorization", "Bearer " + token))
        .andExpect(jsonPath("$.totalElements").value(0));
  }

  private JsonNode add(String token, String body) throws Exception {
    return json.readTree(
        mvc.perform(
                post("/api/v1/vocabulary")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString());
  }

  private String token(String email) throws Exception {
    mvc.perform(
            post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"email\":\""
                        + email
                        + "\",\"password\":\"password123\",\"clbLevel\":\"CLB_5\",\"dailyNewVocabularyGoal\":10}"))
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
        .get("accessToken")
        .asText();
  }
}
