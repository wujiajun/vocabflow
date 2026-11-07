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
class GameWordApiTests {
  private static final LocalDate DAY = LocalDate.of(2026, 12, 1);

  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired JdbcTemplate jdbc;

  @Test
  void theCandidatesAreTheCompletedWordsOfTheLastThirtyDaysAndToday() throws Exception {
    String token = token("games-pool@example.com");
    long today = add(token, "pool today");
    long old = add(token, "pool thirty days");
    long tooOld = add(token, "pool thirty one days");
    long failed = add(token, "pool failed");
    long unrated = add(token, "pool never rated");
    rate(token, tooOld, "EASY", 0, DAY.minusDays(31));
    rate(token, old, "EASY", 0, DAY.minusDays(30));
    rate(token, failed, "EASY", 0, DAY.minusDays(2));
    jdbc.update(
        "UPDATE vocabulary_items SET enrichment_status = 'FAILED' WHERE normalized_term = ?",
        "pool failed");
    rate(token, today, "EASY", 0, DAY);
    // A second rating on another day must not list the word twice.
    rate(token, today, "GOOD", 1, DAY.minusDays(0));

    assertThat(ranked(token)).containsExactlyInAnyOrder(today, old).doesNotContain(unrated);
    assertThat(ranked(token)).doesNotContain(tooOld, failed);
  }

  @Test
  void playedWordsMoveBehindWordsNeverPlayedAndTheCountGrows() throws Exception {
    String token = token("games-rotate@example.com");
    List<Long> ids = new ArrayList<>();
    for (int i = 0; i < 6; i++) {
      long id = add(token, "rotate word " + i);
      rate(token, id, "EASY", 0, DAY.minusDays(1));
      ids.add(id);
    }
    List<Long> firstRound = ids.subList(0, 3);

    played(token, firstRound).andExpect(status().isNoContent());
    assertThat(ranked(token).subList(0, 3)).containsExactlyInAnyOrderElementsOf(ids.subList(3, 6));
    assertThat(ranked(token).subList(3, 6)).containsExactlyInAnyOrderElementsOf(firstRound);

    played(token, firstRound).andExpect(status().isNoContent());
    assertThat(
            jdbc.queryForObject(
                "SELECT play_count FROM game_word_plays WHERE user_vocabulary_id = ?",
                Integer.class,
                firstRound.getFirst()))
        .isEqualTo(2);
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM game_word_plays", Integer.class))
        .isGreaterThanOrEqualTo(3);
  }

  @Test
  void aWordIsPlayedOnceInTheTableEvenWhenListedTwice() throws Exception {
    String token = token("games-twice@example.com");
    long id = add(token, "twice word");
    rate(token, id, "EASY", 0, DAY);

    played(token, List.of(id, id)).andExpect(status().isNoContent());

    assertThat(
            jdbc.queryForObject(
                "SELECT play_count FROM game_word_plays WHERE user_vocabulary_id = ?",
                Integer.class,
                id))
        .isEqualTo(1);
  }

  @Test
  void aHardWordIsPreferredAmongWordsNeverPlayed() throws Exception {
    String token = token("games-hard@example.com");
    List<Long> easy = new ArrayList<>();
    for (int i = 0; i < 4; i++) {
      long id = add(token, "hard easy " + i);
      rate(token, id, "EASY", 0, DAY.minusDays(3));
      easy.add(id);
    }
    long hard = add(token, "hard one");
    rate(token, hard, "AGAIN", 0, DAY.minusDays(3));
    rate(token, hard, "AGAIN", 1, DAY.minusDays(2));

    assertThat(ranked(token).getFirst()).isEqualTo(hard);
  }

  @Test
  void playsAndRankingsBelongToTheUser() throws Exception {
    String owner = token("games-owner@example.com");
    String other = token("games-other@example.com");
    long mine = add(owner, "owner word");
    rate(owner, mine, "EASY", 0, DAY);
    long theirs = add(other, "other word");
    rate(other, theirs, "EASY", 0, DAY);

    assertThat(ranked(owner)).containsExactly(mine);
    assertThat(ranked(other)).containsExactly(theirs);

    played(owner, List.of(theirs)).andExpect(status().isNotFound());
    played(owner, List.of(mine, theirs)).andExpect(status().isNotFound());
    played(owner, List.of(999_999_999L)).andExpect(status().isNotFound());
    assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM game_word_plays WHERE user_id IN "
                    + "(SELECT id FROM users WHERE email IN ('games-owner@example.com','games-other@example.com'))",
                Integer.class))
        .isZero();

    played(owner, List.of(mine)).andExpect(status().isNoContent());
    assertThat(ranked(other)).containsExactly(theirs);
  }

  @Test
  void badRequestsAndMissingSignInAreRefused() throws Exception {
    String token = token("games-bad@example.com");
    played(token, List.of()).andExpect(status().isBadRequest());
    List<Long> many = new ArrayList<>();
    for (long i = 1; i <= 31; i++) {
      many.add(i);
    }
    played(token, many).andExpect(status().isBadRequest());
    mvc.perform(get("/api/v1/learning/game-words").param("date", DAY.toString()))
        .andExpect(status().isUnauthorized());
    mvc.perform(
            post("/api/v1/learning/game-words/played")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"wordIds\":[1]}"))
        .andExpect(status().isUnauthorized());
    mvc.perform(get("/api/v1/learning/game-words").header("Authorization", "Bearer " + token))
        .andExpect(status().isBadRequest());
  }

  @Test
  void aRoundGetsAtMostFifteenCandidates() throws Exception {
    String token = token("games-limit@example.com");
    for (int i = 0; i < 18; i++) {
      long id = add(token, "limit word " + i);
      rate(token, id, "EASY", 0, DAY);
    }
    assertThat(ranked(token)).hasSize(15).doesNotHaveDuplicates();
  }

  private List<Long> ranked(String token) throws Exception {
    JsonNode body =
        json.readTree(
            mvc.perform(
                    get("/api/v1/learning/game-words")
                        .param("date", DAY.toString())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString());
    List<Long> ids = new ArrayList<>();
    body.path("wordIds").forEach(id -> ids.add(id.asLong()));
    return ids;
  }

  private org.springframework.test.web.servlet.ResultActions played(String token, List<Long> ids)
      throws Exception {
    return mvc.perform(
        post("/api/v1/learning/game-words/played")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"wordIds\":" + ids + "}"));
  }

  private void rate(String token, long id, String rating, int version, LocalDate date)
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
