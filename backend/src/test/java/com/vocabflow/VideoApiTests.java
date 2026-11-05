package com.vocabflow;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

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
class VideoApiTests {
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
  void theVideoEndpointsNeedASignedInUser() throws Exception {
    mvc.perform(get("/api/v1/videos/albums")).andExpect(status().isUnauthorized());
    mvc.perform(put("/api/v1/videos/WR9_nsLyaEY/watched")).andExpect(status().isUnauthorized());
  }

  @Test
  void albumsListTheCatalogAndWatchedMarksBelongToTheUser() throws Exception {
    String alice = "Bearer " + token("video-alice@example.com");
    String bob = "Bearer " + token("video-bob@example.com");

    mvc.perform(get("/api/v1/videos/albums").header("Authorization", alice))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].id").value("voa-lle-1"))
        .andExpect(jsonPath("$[0].clbMin").value(1))
        .andExpect(jsonPath("$[0].videoCount").value(4))
        .andExpect(jsonPath("$[0].watchedCount").value(0))
        .andExpect(jsonPath("$[0].coverVideoId").value("WR9_nsLyaEY"));

    mvc.perform(put("/api/v1/videos/WR9_nsLyaEY/watched").header("Authorization", alice))
        .andExpect(status().isNoContent());
    // Marking again is fine.
    mvc.perform(put("/api/v1/videos/WR9_nsLyaEY/watched").header("Authorization", alice))
        .andExpect(status().isNoContent());

    mvc.perform(get("/api/v1/videos/albums/voa-lle-1").header("Authorization", alice))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.watchedCount").value(1))
        .andExpect(jsonPath("$.videos[0].watched").value(true))
        .andExpect(jsonPath("$.videos[0].durationSeconds").value(230))
        .andExpect(jsonPath("$.videos[1].watched").value(false));
    // Another user sees nothing marked.
    mvc.perform(get("/api/v1/videos/albums/voa-lle-1").header("Authorization", bob))
        .andExpect(jsonPath("$.watchedCount").value(0))
        .andExpect(jsonPath("$.videos[0].watched").value(false));

    mvc.perform(delete("/api/v1/videos/WR9_nsLyaEY/watched").header("Authorization", alice))
        .andExpect(status().isNoContent());
    mvc.perform(get("/api/v1/videos/albums").header("Authorization", alice))
        .andExpect(jsonPath("$[0].watchedCount").value(0));
  }

  @Test
  void anUnknownAlbumOrVideoIsNotFound() throws Exception {
    String auth = "Bearer " + token("video-carol@example.com");

    mvc.perform(get("/api/v1/videos/albums/nope").header("Authorization", auth))
        .andExpect(status().isNotFound());
    mvc.perform(put("/api/v1/videos/AAAAAAAAAAA/watched").header("Authorization", auth))
        .andExpect(status().isNotFound());
  }
}
