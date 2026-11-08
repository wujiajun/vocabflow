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
class VocabularySearchApiTests {
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;

  @Test
  void matchesAnywhereInTheWordIgnoringCaseAndSpaces() throws Exception {
    String token = token("search-contains@example.com");
    add(token, "cheese");
    add(token, "Cheeseburger");
    add(token, "purchase");
    add(token, "apple");

    assertThat(terms(token, "?q=CHEES")).containsExactlyInAnyOrder("cheese", "Cheeseburger");
    assertThat(terms(token, "?q=urcha")).containsExactly("purchase");
    assertThat(terms(token, "?q=%20%20apple%20")).containsExactly("apple");
    assertThat(terms(token, "?q=zzz")).isEmpty();
    assertThat(terms(token, "?q=")).hasSize(4);
    assertThat(terms(token, "?q=%20%20")).hasSize(4);
  }

  @Test
  void percentUnderscoreAndBackslashAreTakenLiterally() throws Exception {
    String token = token("search-escape@example.com");
    add(token, "alpha");
    add(token, "beta");
    add(token, "gamma");
    add(token, "50% off");
    add(token, "snake_case");
    add(token, "a\\\\b"); // JSON escape: the word is a\b

    // A search for the characters finds only words that really contain them.
    assertThat(terms(token, "?q=%25")).containsExactly("50% off");
    assertThat(terms(token, "?q=e_c")).containsExactly("snake_case");
    assertThat(terms(token, "?q=%5C")).containsExactly("a\\b");
    // Unescaped, "%" would match everything and "_" any single letter.
    assertThat(terms(token, "?q=al%25")).isEmpty();
    assertThat(terms(token, "?q=a_p")).isEmpty();
    assertThat(terms(token, "?q=!")).isEmpty();
    assertThat(terms(token, "?q=e%25c")).isEmpty();
  }

  @Test
  void aSearchIsLimitedToTheSignedInUsersWords() throws Exception {
    String mine = token("search-mine@example.com");
    String other = token("search-other@example.com");
    add(mine, "lantern");
    add(other, "lanterns");
    add(other, "landscape");

    assertThat(terms(mine, "?q=lant")).containsExactly("lantern");
    assertThat(terms(other, "?q=lant")).containsExactly("lanterns");
  }

  @Test
  void aSearchIsPagedAndCombinesWithTheStatusFilter() throws Exception {
    String token = token("search-paging@example.com");
    for (int i = 0; i < 5; i++) {
      add(token, "bridge" + "abcde".charAt(i));
    }
    add(token, "tunnel");

    JsonNode first = page(token, "?q=bridge&size=2&page=0");
    assertThat(first.get("totalElements").asInt()).isEqualTo(5);
    assertThat(first.get("totalPages").asInt()).isEqualTo(3);
    assertThat(first.get("content")).hasSize(2);
    JsonNode last = page(token, "?q=bridge&size=2&page=2");
    assertThat(last.get("content")).hasSize(1);

    assertThat(terms(token, "?q=bridge&status=NEW")).hasSize(5);
    assertThat(terms(token, "?q=bridge&status=MASTERED")).isEmpty();
    assertThat(terms(token, "?q=tunnel&status=NEW")).containsExactly("tunnel");
  }

  private JsonNode page(String token, String query) throws Exception {
    return json.readTree(
        mvc.perform(
                get(java.net.URI.create("/api/v1/vocabulary" + query))
                    .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString());
  }

  private List<String> terms(String token, String query) throws Exception {
    List<String> result = new ArrayList<>();
    page(token, query + (query.contains("size=") ? "" : "&size=100"))
        .get("content")
        .forEach(item -> result.add(item.get("term").asText()));
    return result;
  }

  private void add(String token, String term) throws Exception {
    mvc.perform(
            post("/api/v1/vocabulary")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"term\":\"" + term + "\"}"))
        .andExpect(status().isOk());
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
