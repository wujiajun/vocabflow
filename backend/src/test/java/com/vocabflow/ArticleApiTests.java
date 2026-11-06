package com.vocabflow;

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
class ArticleApiTests {
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;

  String token(String email) throws Exception {
    mvc.perform(
            post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"email\":\""
                        + email
                        + "\",\"password\":\"password123\",\"clbLevel\":\"CLB_5\",\"dailyNewVocabularyGoal\":10}"))
        .andExpect(status().isOk());
    return "Bearer "
        + json.readTree(
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

  JsonNode fetch(String path, String auth) throws Exception {
    return json.readTree(
        mvc.perform(get(path).header("Authorization", auth))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString());
  }

  @Test
  void theArticleEndpointsNeedASignedInUser() throws Exception {
    mvc.perform(get("/api/v1/articles/albums")).andExpect(status().isUnauthorized());
    mvc.perform(put("/api/v1/articles/1/read")).andExpect(status().isUnauthorized());
  }

  @Test
  void readMarksBelongToTheUserAndTheArticleCarriesItsTextAndGlossary() throws Exception {
    String alice = token("article-alice@example.com");
    String bob = token("article-bob@example.com");

    JsonNode albums = fetch("/api/v1/articles/albums", alice);
    String albumId = albums.get(0).get("id").asText();
    org.assertj.core.api.Assertions.assertThat(albums.get(0).get("readCount").asInt()).isZero();
    org.assertj.core.api.Assertions.assertThat(albums.get(0).get("articleCount").asInt())
        .isPositive();

    String articleId =
        fetch("/api/v1/articles/albums/" + albumId, alice)
            .get("articles")
            .get(0)
            .get("id")
            .asText();
    JsonNode article = fetch("/api/v1/articles/" + articleId, alice);
    org.assertj.core.api.Assertions.assertThat(article.get("text").asText()).isNotBlank();
    org.assertj.core.api.Assertions.assertThat(article.get("sourceUrl").asText())
        .startsWith("https://learningenglish.voanews.com/a/");
    org.assertj.core.api.Assertions.assertThat(article.get("albumId").asText()).isEqualTo(albumId);
    org.assertj.core.api.Assertions.assertThat(article.get("read").asBoolean()).isFalse();

    mvc.perform(put("/api/v1/articles/" + articleId + "/read").header("Authorization", alice))
        .andExpect(status().isNoContent());
    // Marking again is fine.
    mvc.perform(put("/api/v1/articles/" + articleId + "/read").header("Authorization", alice))
        .andExpect(status().isNoContent());

    mvc.perform(get("/api/v1/articles/albums/" + albumId).header("Authorization", alice))
        .andExpect(jsonPath("$.readCount").value(1))
        .andExpect(jsonPath("$.articles[0].read").value(true));
    mvc.perform(get("/api/v1/articles/" + articleId).header("Authorization", alice))
        .andExpect(jsonPath("$.read").value(true))
        .andExpect(jsonPath("$.readAt").isNotEmpty());
    // Another user sees nothing marked.
    mvc.perform(get("/api/v1/articles/albums/" + albumId).header("Authorization", bob))
        .andExpect(jsonPath("$.readCount").value(0))
        .andExpect(jsonPath("$.articles[0].read").value(false));
    mvc.perform(get("/api/v1/articles/" + articleId).header("Authorization", bob))
        .andExpect(jsonPath("$.read").value(false));

    mvc.perform(delete("/api/v1/articles/" + articleId + "/read").header("Authorization", alice))
        .andExpect(status().isNoContent());
    mvc.perform(get("/api/v1/articles/albums").header("Authorization", alice))
        .andExpect(jsonPath("$[0].readCount").value(0));
  }

  @Test
  void anUnknownAlbumOrArticleIsNotFound() throws Exception {
    String auth = token("article-carol@example.com");
    mvc.perform(get("/api/v1/articles/albums/nope").header("Authorization", auth))
        .andExpect(status().isNotFound());
    mvc.perform(get("/api/v1/articles/999999999999").header("Authorization", auth))
        .andExpect(status().isNotFound());
    mvc.perform(put("/api/v1/articles/999999999999/read").header("Authorization", auth))
        .andExpect(status().isNotFound());
  }
}
