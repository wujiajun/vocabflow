package com.vocabflow;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

@SpringBootTest(properties = "vocabflow.auth.invite-code=correct-code")
@AutoConfigureMockMvc
@ActiveProfiles("test")
class InviteCodeApiTests {
  @Autowired MockMvc mvc;

  @Test
  void registeringNeedsTheInviteCode() throws Exception {
    register("invited@example.com", ",\"inviteCode\":\"correct-code\"")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.email").value("invited@example.com"));
  }

  @Test
  void aMissingOrWrongCodeIsRefusedWithoutCreatingTheAccount() throws Exception {
    for (String code : new String[] {"", ",\"inviteCode\":\"wrong\"", ",\"inviteCode\":\"\""}) {
      register("uninvited@example.com", code)
          .andExpect(status().isForbidden())
          .andExpect(jsonPath("$.code").value("INVALID_INVITE_CODE"));
    }
    mvc.perform(
            post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"uninvited@example.com\",\"password\":\"password123\"}"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void aWrongCodeDoesNotRevealWhetherAnEmailIsRegistered() throws Exception {
    register("taken@example.com", ",\"inviteCode\":\"correct-code\"").andExpect(status().isOk());

    register("taken@example.com", ",\"inviteCode\":\"wrong\"")
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("INVALID_INVITE_CODE"));
  }

  @Test
  void theHealthCheckIsPublicAndRevealsNothingElse() throws Exception {
    mvc.perform(get("/api/v1/health"))
        .andExpect(status().isOk())
        .andExpect(content().json("{\"status\":\"UP\"}", true));
  }

  private ResultActions register(String email, String inviteCodeField) throws Exception {
    return mvc.perform(
        post("/api/v1/auth/register")
            .contentType(MediaType.APPLICATION_JSON)
            .content(
                "{\"email\":\""
                    + email
                    + "\",\"password\":\"password123\",\"clbLevel\":\"CLB_5\",\"dailyNewVocabularyGoal\":10"
                    + inviteCodeField
                    + "}"));
  }
}
