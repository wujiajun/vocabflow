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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class QuickAddApiTests {
  private static final String KEY_HEADER = "X-Quick-Add-Key";

  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired JdbcTemplate jdbc;

  @Test
  void aLearnerMakesAKeyAndAddsWordsWithItAlone() throws Exception {
    String token = token("qa-basic@example.com");
    String key = newKey(token);
    assertThat(key).startsWith("vfq_").hasSizeGreaterThan(40);

    JsonNode added = body(quickAdd(key, "assumption").andExpect(status().isOk()));
    assertThat(added.path("added").asBoolean()).isTrue();
    assertThat(added.path("term").asText()).isEqualTo("assumption");
    assertThat(added.path("message").asText()).contains("assumption");

    JsonNode list =
        body(mvc.perform(get("/api/v1/vocabulary").header("Authorization", "Bearer " + token)));
    assertThat(list.path("content"))
        .anySatisfy(w -> assertThat(w.path("term").asText()).isEqualToIgnoringCase("assumption"));

    JsonNode again = body(quickAdd(key, " Assumption ").andExpect(status().isOk()));
    assertThat(again.path("added").asBoolean()).as("already in the list").isFalse();
    assertThat(again.path("message").asText()).contains("already");
  }

  @Test
  void onlyTheHashOfTheKeyIsStoredAndUseIsRecorded() throws Exception {
    String token = token("qa-hash@example.com");
    long user = userId("qa-hash@example.com");
    String key = newKey(token);

    String stored =
        jdbc.queryForObject(
            "SELECT key_hash FROM quick_add_keys WHERE user_id = ?", String.class, user);
    assertThat(stored).hasSize(64).isNotEqualTo(key).doesNotContain(key);
    assertThat(keyStatus(token).path("lastUsedAt").isNull()).isTrue();

    quickAdd(key, "stored hash word").andExpect(status().isOk());
    JsonNode status = keyStatus(token);
    assertThat(status.path("exists").asBoolean()).isTrue();
    assertThat(status.path("lastUsedAt").isNull()).isFalse();
  }

  @Test
  void aMissingWrongOrMalformedKeyIsRefused() throws Exception {
    token("qa-bad@example.com");
    mvc.perform(
            post("/api/v1/quick-add")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"term\":\"nokey\"}"))
        .andExpect(status().isUnauthorized());
    quickAdd("vfq_" + "A".repeat(43), "wrong").andExpect(status().isUnauthorized());
    quickAdd("not-a-key", "malformed").andExpect(status().isUnauthorized());
    quickAdd("vfq_" + "A".repeat(500), "toolong").andExpect(status().isUnauthorized());
  }

  @Test
  void theKeyOpensOnlyTheDoorThatAddsAWord() throws Exception {
    String token = token("qa-door@example.com");
    String key = newKey(token);

    mvc.perform(get("/api/v1/vocabulary").header(KEY_HEADER, key))
        .andExpect(status().isUnauthorized());
    mvc.perform(get("/api/v1/auth/me").header(KEY_HEADER, key))
        .andExpect(status().isUnauthorized());
    mvc.perform(get("/api/v1/quick-add/key").header(KEY_HEADER, key))
        .andExpect(status().isUnauthorized());
    mvc.perform(post("/api/v1/quick-add/key").header(KEY_HEADER, key))
        .andExpect(status().isUnauthorized());
    mvc.perform(delete("/api/v1/quick-add/key").header(KEY_HEADER, key))
        .andExpect(status().isUnauthorized());
    mvc.perform(
            post("/api/v1/vocabulary")
                .header(KEY_HEADER, key)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"term\":\"sneaky\"}"))
        .andExpect(status().isUnauthorized());
    // The key still works where it should.
    quickAdd(key, "door word").andExpect(status().isOk());
  }

  @Test
  void aNewKeyReplacesTheOldOneAndRevokingStopsIt() throws Exception {
    String token = token("qa-replace@example.com");
    String first = newKey(token);
    String second = newKey(token);
    assertThat(second).isNotEqualTo(first);
    quickAdd(first, "old key").andExpect(status().isUnauthorized());
    quickAdd(second, "new key").andExpect(status().isOk());

    mvc.perform(delete("/api/v1/quick-add/key").header("Authorization", "Bearer " + token))
        .andExpect(status().isNoContent());
    quickAdd(second, "revoked").andExpect(status().isUnauthorized());
    assertThat(keyStatus(token).path("exists").asBoolean()).isFalse();
    mvc.perform(delete("/api/v1/quick-add/key").header("Authorization", "Bearer " + token))
        .andExpect(status().isNoContent());
  }

  @Test
  void aKeyAddsToItsOwnersListOnly() throws Exception {
    String alice = token("qa-alice@example.com");
    String bob = token("qa-bob@example.com");
    String aliceKey = newKey(alice);
    quickAdd(aliceKey, "alices private word").andExpect(status().isOk());

    JsonNode bobList =
        body(mvc.perform(get("/api/v1/vocabulary").header("Authorization", "Bearer " + bob)));
    assertThat(bobList.path("content"))
        .noneSatisfy(w -> assertThat(w.path("term").asText()).containsIgnoringCase("alices"));
    assertThat(keyStatus(bob).path("exists").asBoolean()).isFalse();
  }

  @Test
  void managingTheKeyNeedsASignIn() throws Exception {
    mvc.perform(get("/api/v1/quick-add/key")).andExpect(status().isUnauthorized());
    mvc.perform(post("/api/v1/quick-add/key")).andExpect(status().isUnauthorized());
    mvc.perform(delete("/api/v1/quick-add/key")).andExpect(status().isUnauthorized());
  }

  @Test
  void aBlankOrTooLongWordIsRejectedAndASignInAlsoWorksForAdding() throws Exception {
    String token = token("qa-valid@example.com");
    String key = newKey(token);
    quickAdd(key, "   ").andExpect(status().isBadRequest());
    quickAdd(key, "x".repeat(256)).andExpect(status().isBadRequest());
    mvc.perform(
            post("/api/v1/quick-add")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"term\":\"with sign in\"}"))
        .andExpect(status().isOk());
  }

  private ResultActions quickAdd(String key, String term) throws Exception {
    return mvc.perform(
        post("/api/v1/quick-add")
            .header(KEY_HEADER, key)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"term\":\"" + term + "\"}"));
  }

  private String newKey(String token) throws Exception {
    return body(mvc.perform(
                post("/api/v1/quick-add/key").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()))
        .path("key")
        .asText();
  }

  private JsonNode keyStatus(String token) throws Exception {
    return body(
        mvc.perform(get("/api/v1/quick-add/key").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()));
  }

  private JsonNode body(ResultActions result) throws Exception {
    return json.readTree(result.andReturn().getResponse().getContentAsString());
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
    return body(mvc.perform(
                post("/api/v1/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"" + email + "\",\"password\":\"password123\"}"))
            .andExpect(status().isOk()))
        .path("accessToken")
        .asText();
  }
}
