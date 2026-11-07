package com.vocabflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vocabflow.learning.application.GameRoundService;
import java.time.LocalDate;
import java.time.ZoneOffset;
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
class GameRoundApiTests {
  private static final LocalDate TODAY = LocalDate.now(ZoneOffset.UTC);

  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired JdbcTemplate jdbc;
  @Autowired GameRoundService service;

  @Test
  void aFinishedRoundIsStoredForTheSignedInUser() throws Exception {
    String token = token("rounds-store@example.com");
    long userId = userId("rounds-store@example.com");

    String body =
        round(token, "spell-it", 2, 3, 10, TODAY)
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();

    assertThat(json.readTree(body).path("id").asLong()).isPositive();
    var row =
        jdbc.queryForMap(
            "SELECT game, stars, mistakes, word_count, study_date, finished_at "
                + "FROM game_rounds WHERE user_id = ?",
            userId);
    assertThat(row.get("game")).isEqualTo("spell-it");
    assertThat(row.get("stars")).isEqualTo(2);
    assertThat(row.get("mistakes")).isEqualTo(3);
    assertThat(row.get("word_count")).isEqualTo(10);
    assertThat(row.get("finished_at")).isNotNull();
    assertThat(service.countRounds(userId, TODAY)).isEqualTo(1);
  }

  @Test
  void everyGameIdIsAcceptedAndOthersAreRefused() throws Exception {
    String token = token("rounds-games@example.com");
    for (String game : new String[] {"quick-review", "fill-blank", "listen-choose", "spell-it"}) {
      round(token, game, 3, 0, 10, TODAY).andExpect(status().isCreated());
    }
    round(token, "hangman", 3, 0, 10, TODAY).andExpect(status().isBadRequest());
    round(token, "SPELL_IT", 3, 0, 10, TODAY).andExpect(status().isBadRequest());
    assertThat(service.countRounds(userId("rounds-games@example.com"), TODAY)).isEqualTo(4);
  }

  @Test
  void outOfRangeValuesAreRefusedWithTheStandardError() throws Exception {
    String token = token("rounds-range@example.com");
    round(token, "spell-it", 4, 0, 10, TODAY).andExpect(status().isBadRequest());
    round(token, "spell-it", -1, 0, 10, TODAY).andExpect(status().isBadRequest());
    round(token, "spell-it", 1, -1, 10, TODAY).andExpect(status().isBadRequest());
    round(token, "spell-it", 1, 0, 0, TODAY)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").exists())
        .andExpect(jsonPath("$.message").exists())
        .andExpect(jsonPath("$.timestamp").exists());
    raw(token, "{\"game\":\"spell-it\",\"stars\":1,\"mistakes\":0,\"wordCount\":10}")
        .andExpect(status().isBadRequest());
    raw(token, "{\"game\":\"spell-it\",\"stars\":1,\"mistakes\":0,\"wordCount\":10,\"date\":\"x\"}")
        .andExpect(status().isBadRequest());
    assertThat(service.countRounds(userId("rounds-range@example.com"), TODAY)).isZero();
  }

  @Test
  void theDateMustBeWithinOneDayOfTheServersUtcDate() throws Exception {
    String token = token("rounds-date@example.com");
    round(token, "fill-blank", 1, 1, 5, TODAY.minusDays(1)).andExpect(status().isCreated());
    round(token, "fill-blank", 1, 1, 5, TODAY.plusDays(1)).andExpect(status().isCreated());
    round(token, "fill-blank", 1, 1, 5, TODAY.minusDays(2)).andExpect(status().isBadRequest());
    round(token, "fill-blank", 1, 1, 5, TODAY.plusDays(2)).andExpect(status().isBadRequest());
  }

  @Test
  void roundsBelongToTheUserAndAClientUserIdIsIgnored() throws Exception {
    String a = token("rounds-a@example.com");
    String b = token("rounds-b@example.com");
    long idA = userId("rounds-a@example.com");
    long idB = userId("rounds-b@example.com");
    raw(
            a,
            "{\"userId\":"
                + idB
                + ",\"game\":\"spell-it\",\"stars\":3,\"mistakes\":0,\"wordCount\":10,\"date\":\""
                + TODAY
                + "\"}")
        .andExpect(status().isCreated());
    round(b, "quick-review", 1, 4, 10, TODAY).andExpect(status().isCreated());

    assertThat(service.countRounds(idA, TODAY)).isEqualTo(1);
    assertThat(service.bestStars(idA, TODAY)).isEqualTo(3);
    assertThat(service.countRounds(idB, TODAY)).isEqualTo(1);
    assertThat(service.bestStars(idB, TODAY)).isEqualTo(1);
    assertThat(service.countRounds(idA, TODAY.minusDays(1))).isZero();
    assertThat(service.bestStars(idA, TODAY.minusDays(1))).isZero();
  }

  @Test
  void signInIsRequired() throws Exception {
    mvc.perform(
            post("/api/v1/learning/game-rounds")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
        .andExpect(status().isUnauthorized());
  }

  private ResultActions round(
      String token, String game, int stars, int mistakes, int words, LocalDate date)
      throws Exception {
    return raw(
        token,
        "{\"game\":\""
            + game
            + "\",\"stars\":"
            + stars
            + ",\"mistakes\":"
            + mistakes
            + ",\"wordCount\":"
            + words
            + ",\"date\":\""
            + date
            + "\"}");
  }

  private ResultActions raw(String token, String body) throws Exception {
    return mvc.perform(
        post("/api/v1/learning/game-rounds")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
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
