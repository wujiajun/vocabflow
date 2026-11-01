package com.vocabflow;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vocabflow.vocabulary.application.VocabularyEnrichmentProvider;
import com.vocabflow.vocabulary.domain.EnrichmentResult;
import com.vocabflow.vocabulary.domain.VocabularyTerm;
import com.vocabflow.vocabulary.domain.VocabularyType;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = "vocabflow.enrichment.daily-limit=3")
@AutoConfigureMockMvc
@ActiveProfiles("test")
class EnrichmentRetryApiTests {
  static final AtomicBoolean providerDown = new AtomicBoolean();

  @TestConfiguration
  static class Config {
    @Bean
    @Primary
    VocabularyEnrichmentProvider flakyProvider() {
      return new VocabularyEnrichmentProvider() {
        @Override
        public EnrichmentResult enrich(VocabularyTerm term) {
          if (providerDown.get()) {
            throw new IllegalStateException("provider down");
          }
          return new EnrichmentResult(
              VocabularyType.WORD, null, "noun", "a definition", List.of("an example"), List.of());
        }
      };
    }
  }

  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;

  @BeforeEach
  void providerWorks() {
    providerDown.set(false);
  }

  @Test
  void failedEnrichmentCanBeRetriedUntilItCompletesAndTheDailyLimitStopsFurtherCalls()
      throws Exception {
    String owner = token("retry-owner@example.com");
    providerDown.set(true);
    long id = add(owner, "unreliable");
    mvc.perform(get("/api/v1/vocabulary/" + id).header("Authorization", "Bearer " + owner))
        .andExpect(jsonPath("$.enrichmentStatus").value("FAILED"))
        .andExpect(jsonPath("$.failureReason").value("Enrichment could not be completed"));

    mvc.perform(
            post("/api/v1/vocabulary/" + id + "/enrichment/retry")
                .header("Authorization", "Bearer " + owner))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.enrichmentStatus").value("FAILED"));

    providerDown.set(false);
    mvc.perform(
            post("/api/v1/vocabulary/" + id + "/enrichment/retry")
                .header("Authorization", "Bearer " + owner))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.enrichmentStatus").value("COMPLETED"))
        .andExpect(jsonPath("$.definition").value("a definition"))
        .andExpect(jsonPath("$.failureReason").isEmpty());

    mvc.perform(
            post("/api/v1/vocabulary/" + id + "/enrichment/retry")
                .header("Authorization", "Bearer " + owner))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("CONFLICT"));

    // Three calls so far today (add, retry, retry): a fourth term is saved but not enriched.
    long over = add(owner, "over the limit");
    mvc.perform(get("/api/v1/vocabulary/" + over).header("Authorization", "Bearer " + owner))
        .andExpect(jsonPath("$.enrichmentStatus").value("FAILED"))
        .andExpect(jsonPath("$.failureReason").value("Daily enrichment limit reached"));
    mvc.perform(
            post("/api/v1/vocabulary/" + over + "/enrichment/retry")
                .header("Authorization", "Bearer " + owner))
        .andExpect(status().isTooManyRequests())
        .andExpect(jsonPath("$.code").value("ENRICHMENT_LIMIT_REACHED"));
  }

  @Test
  void aUserCannotRetryAnotherUsersVocabularyAndMustBeSignedIn() throws Exception {
    String owner = token("retry-isolation-owner@example.com");
    String other = token("retry-isolation-other@example.com");
    providerDown.set(true);
    long id = add(owner, "isolated");

    mvc.perform(
            post("/api/v1/vocabulary/" + id + "/enrichment/retry")
                .header("Authorization", "Bearer " + other))
        .andExpect(status().isNotFound());
    mvc.perform(post("/api/v1/vocabulary/" + id + "/enrichment/retry"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void aFailedWordCanBeRemovedWithItsPlaceInTheDailyPlanAndAddedAgainAfterwards() throws Exception {
    String owner = token("remove-owner@example.com");
    providerDown.set(true);
    long id = add(owner, "typo");
    long kept = add(owner, "another typo");
    // The plan is stored with both words in it.
    mvc.perform(get("/api/v1/learning/daily-plan").header("Authorization", "Bearer " + owner))
        .andExpect(jsonPath("$.newItems.length()").value(2));

    mvc.perform(delete("/api/v1/vocabulary/" + id).header("Authorization", "Bearer " + owner))
        .andExpect(status().isNoContent());

    mvc.perform(get("/api/v1/vocabulary/" + id).header("Authorization", "Bearer " + owner))
        .andExpect(status().isNotFound());
    mvc.perform(get("/api/v1/vocabulary/" + kept).header("Authorization", "Bearer " + owner))
        .andExpect(status().isOk());
    mvc.perform(get("/api/v1/learning/daily-plan").header("Authorization", "Bearer " + owner))
        .andExpect(jsonPath("$.newItems.length()").value(1))
        .andExpect(jsonPath("$.newItems[0].term").value("another typo"));
    mvc.perform(delete("/api/v1/vocabulary/" + id).header("Authorization", "Bearer " + owner))
        .andExpect(status().isNotFound());

    providerDown.set(false);
    long again = add(owner, "typo");
    mvc.perform(get("/api/v1/vocabulary/" + again).header("Authorization", "Bearer " + owner))
        .andExpect(jsonPath("$.enrichmentStatus").value("COMPLETED"));
  }

  @Test
  void onlyAFailedWordOfTheSignedInUserCanBeRemoved() throws Exception {
    String owner = token("remove-guard-owner@example.com");
    String other = token("remove-guard-other@example.com");
    long done = add(owner, "fine");
    providerDown.set(true);
    long failed = add(owner, "broken word");

    mvc.perform(delete("/api/v1/vocabulary/" + done).header("Authorization", "Bearer " + owner))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.message").value("Only a failed word can be removed"));
    mvc.perform(delete("/api/v1/vocabulary/" + failed).header("Authorization", "Bearer " + other))
        .andExpect(status().isNotFound());
    mvc.perform(delete("/api/v1/vocabulary/" + failed)).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/v1/vocabulary/" + failed).header("Authorization", "Bearer " + owner))
        .andExpect(status().isOk());
  }

  private long add(String token, String term) throws Exception {
    String body =
        mvc.perform(
                post("/api/v1/vocabulary")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"term\":\"" + term + "\"}"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return json.readTree(body).get("id").asLong();
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
    String login =
        mvc.perform(
                post("/api/v1/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"" + email + "\",\"password\":\"password123\"}"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return json.readTree(login).get("accessToken").asText();
  }
}
