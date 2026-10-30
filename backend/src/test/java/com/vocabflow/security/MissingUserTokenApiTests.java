package com.vocabflow.security;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.vocabflow.identity.application.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/**
 * A token has a valid signature but its user is gone (for example the in-memory test database was
 * reset). Every protected endpoint must answer the same 401, not 200 or 500.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MissingUserTokenApiTests {
  private static final long MISSING_USER_ID = 987_654_321L;

  @Autowired MockMvc mvc;
  @Autowired TokenService tokens;
  @Autowired UserRepository users;

  String bearerForMissingUser() {
    return "Bearer " + tokens.issue(MISSING_USER_ID, "gone@example.com");
  }

  void expectUnauthorized(ResultActions result) throws Exception {
    result
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
        .andExpect(jsonPath("$.message").exists())
        .andExpect(jsonPath("$.timestamp").exists());
  }

  @Test
  void theUserReallyDoesNotExist() {
    org.assertj.core.api.Assertions.assertThat(users.findById(MISSING_USER_ID)).isEmpty();
  }

  @Test
  void currentUserIsRejected() throws Exception {
    expectUnauthorized(
        mvc.perform(get("/api/v1/auth/me").header("Authorization", bearerForMissingUser())));
  }

  @Test
  void vocabularyListIsRejected() throws Exception {
    expectUnauthorized(
        mvc.perform(get("/api/v1/vocabulary").header("Authorization", bearerForMissingUser())));
  }

  @Test
  void addingVocabularyIsRejectedInsteadOfFailingWithServerError() throws Exception {
    expectUnauthorized(
        mvc.perform(
            post("/api/v1/vocabulary")
                .header("Authorization", bearerForMissingUser())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"term\":\"overwhelmed\"}")));
  }

  @Test
  void dailyPlanIsRejected() throws Exception {
    expectUnauthorized(
        mvc.perform(
            get("/api/v1/learning/daily-plan")
                .param("date", "2026-10-30")
                .header("Authorization", bearerForMissingUser())));
  }
}
