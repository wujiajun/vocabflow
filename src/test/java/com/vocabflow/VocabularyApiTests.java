package com.vocabflow;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.*;
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
    mvc.perform(get("/api/v1/vocabulary")).andExpect(status().isForbidden());
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
            .andExpect(jsonPath("$.enrichmentStatus").value("COMPLETED"))
            .andReturn()
            .getResponse()
            .getContentAsString();
    long id = json.readTree(body).get("id").asLong();
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
}
