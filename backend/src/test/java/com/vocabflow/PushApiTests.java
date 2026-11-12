package com.vocabflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vocabflow.push.application.WebPushSender;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PushApiTests {
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired JdbcTemplate jdbc;

  // The real sender would talk to push services; here it is a mock and nothing leaves the test.
  @MockitoBean WebPushSender sender;

  @BeforeEach
  void senderOn() {
    when(sender.enabled()).thenReturn(true);
    when(sender.publicKey()).thenReturn("PUBLIC-KEY");
  }

  @Test
  void configShowsTheKeyOnlyWhenRemindersAreOn() throws Exception {
    String token = token("push-config@example.com");

    mvc.perform(get("/api/v1/push/config").header("Authorization", "Bearer " + token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.enabled").value(true))
        .andExpect(jsonPath("$.publicKey").value("PUBLIC-KEY"));

    when(sender.enabled()).thenReturn(false);
    mvc.perform(get("/api/v1/push/config").header("Authorization", "Bearer " + token))
        .andExpect(jsonPath("$.enabled").value(false))
        .andExpect(jsonPath("$.publicKey").doesNotExist());
  }

  @Test
  void subscribingStoresTheSubscriptionAndSavingAgainChangesTheTime() throws Exception {
    String token = token("push-store@example.com");

    subscribe(token, "https://push.test/store", "19:00").andExpect(status().isNoContent());
    subscribe(token, "https://push.test/store", "20:30").andExpect(status().isNoContent());

    mvc.perform(get("/api/v1/push/subscription").header("Authorization", "Bearer " + token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(1))
        .andExpect(jsonPath("$[0].endpoint").value("https://push.test/store"))
        .andExpect(jsonPath("$[0].remindAt").value("20:30"));
  }

  @Test
  void aUserSeesAndRemovesOnlyOwnSubscriptions() throws Exception {
    String alice = token("push-alice@example.com");
    String bob = token("push-bob@example.com");
    subscribe(alice, "https://push.test/alice", "19:00").andExpect(status().isNoContent());

    mvc.perform(get("/api/v1/push/subscription").header("Authorization", "Bearer " + bob))
        .andExpect(jsonPath("$.length()").value(0));
    mvc.perform(
            delete("/api/v1/push/subscription")
                .header("Authorization", "Bearer " + bob)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"endpoint\":\"https://push.test/alice\"}"))
        .andExpect(status().isNoContent());
    assertThat(count("https://push.test/alice")).isEqualTo(1);

    mvc.perform(
            delete("/api/v1/push/subscription")
                .header("Authorization", "Bearer " + alice)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"endpoint\":\"https://push.test/alice\"}"))
        .andExpect(status().isNoContent());
    assertThat(count("https://push.test/alice")).isZero();
  }

  @Test
  void aBadTimeOrAddressIsRefused() throws Exception {
    String token = token("push-bad@example.com");

    subscribe(token, "https://push.test/bad", "7pm").andExpect(status().isBadRequest());
    subscribe(token, "http://push.test/bad", "19:00").andExpect(status().isBadRequest());
    assertThat(count("https://push.test/bad")).isZero();
  }

  @Test
  void withoutKeysSubscribingSaysSoAndStoresNothing() throws Exception {
    String token = token("push-off@example.com");
    when(sender.enabled()).thenReturn(false);

    subscribe(token, "https://push.test/off", "19:00").andExpect(status().isServiceUnavailable());

    assertThat(count("https://push.test/off")).isZero();
  }

  @Test
  void signingInIsRequired() throws Exception {
    mvc.perform(get("/api/v1/push/subscription")).andExpect(status().isUnauthorized());
    mvc.perform(
            post("/api/v1/push/subscription").contentType(MediaType.APPLICATION_JSON).content("{}"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void switchingOnAfterTheTimeMarksTodayAsSent() throws Exception {
    String token = token("push-late@example.com");

    subscribe(token, "https://push.test/late", "00:00").andExpect(status().isNoContent());

    assertThat(
            jdbc.queryForObject(
                "SELECT last_sent_date FROM push_subscriptions WHERE endpoint = ?",
                java.sql.Date.class,
                "https://push.test/late"))
        .isNotNull();
  }

  private ResultActions subscribe(String token, String endpoint, String remindAt) throws Exception {
    return mvc.perform(
        post("/api/v1/push/subscription")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(
                "{\"endpoint\":\""
                    + endpoint
                    + "\",\"p256dh\":\"key\",\"auth\":\"auth\",\"remindAt\":\""
                    + remindAt
                    + "\",\"deviceZone\":\"America/Vancouver\"}"));
  }

  private int count(String endpoint) {
    return jdbc.queryForObject(
        "SELECT COUNT(*) FROM push_subscriptions WHERE endpoint = ?", Integer.class, endpoint);
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
