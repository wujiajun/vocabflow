package com.vocabflow;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
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
class ScenarioApiTests {
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;

  String token() throws Exception {
    String email = UUID.randomUUID() + "@example.com";
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
  void scenariosNeedASignedInUser() throws Exception {
    mvc.perform(get("/api/v1/scenarios")).andExpect(status().isUnauthorized());
  }

  @Test
  void aLearnerListsReadsAndFinishesAScenarioOnlyForThemselves() throws Exception {
    String mine = "Bearer " + token();
    String other = "Bearer " + token();

    mvc.perform(get("/api/v1/scenarios").header("Authorization", mine))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].id").value("renting-an-apartment"))
        .andExpect(jsonPath("$[0].completed").value(false));

    mvc.perform(get("/api/v1/scenarios/renting-an-apartment").header("Authorization", mine))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.text").value(org.hamcrest.Matchers.containsString("Ms. Patel:")))
        .andExpect(jsonPath("$.keywords[0].zh").isNotEmpty())
        .andExpect(jsonPath("$.quiz[0].options").isArray())
        .andExpect(jsonPath("$.verify").doesNotExist());

    mvc.perform(
            put("/api/v1/scenarios/renting-an-apartment/complete")
                .header("Authorization", mine)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"score\":3}"))
        .andExpect(status().isNoContent());
    mvc.perform(
            put("/api/v1/scenarios/renting-an-apartment/complete")
                .header("Authorization", mine)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"score\":1}"))
        .andExpect(status().isNoContent());
    mvc.perform(
            put("/api/v1/scenarios/renting-an-apartment/complete").header("Authorization", mine))
        .andExpect(status().isNoContent());

    mvc.perform(get("/api/v1/scenarios/renting-an-apartment").header("Authorization", mine))
        .andExpect(jsonPath("$.completed").value(true))
        .andExpect(jsonPath("$.bestScore").value(3));
    mvc.perform(get("/api/v1/scenarios/renting-an-apartment").header("Authorization", other))
        .andExpect(jsonPath("$.completed").value(false));
  }

  @Test
  void unknownScenarioAndImpossibleScoreAreRejected() throws Exception {
    String auth = "Bearer " + token();
    mvc.perform(get("/api/v1/scenarios/nope").header("Authorization", auth))
        .andExpect(status().isNotFound());
    mvc.perform(
            put("/api/v1/scenarios/renting-an-apartment/complete")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"score\":99}"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void theLatestSpeakingScoreIsSavedForTheLearnerAlone() throws Exception {
    String mine = "Bearer " + token();
    String other = "Bearer " + token();

    for (int score : new int[] {95, 70}) {
      mvc.perform(
              put("/api/v1/scenarios/renting-an-apartment/speaking")
                  .header("Authorization", mine)
                  .contentType(MediaType.APPLICATION_JSON)
                  .content("{\"score\":" + score + "}"))
          .andExpect(status().isNoContent());
    }

    mvc.perform(get("/api/v1/scenarios").header("Authorization", mine))
        .andExpect(jsonPath("$[0].speakingScore").value(70))
        .andExpect(jsonPath("$[0].spokenAt").isNotEmpty())
        .andExpect(jsonPath("$[0].completed").value(true));
    mvc.perform(get("/api/v1/scenarios/renting-an-apartment").header("Authorization", mine))
        .andExpect(jsonPath("$.speakingScore").value(70))
        .andExpect(jsonPath("$.bestScore").doesNotExist());
    // Finishing the quiz afterwards keeps the speaking score.
    mvc.perform(
            put("/api/v1/scenarios/renting-an-apartment/complete")
                .header("Authorization", mine)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"score\":2}"))
        .andExpect(status().isNoContent());
    mvc.perform(get("/api/v1/scenarios/renting-an-apartment").header("Authorization", mine))
        .andExpect(jsonPath("$.speakingScore").value(70))
        .andExpect(jsonPath("$.bestScore").value(2));
    mvc.perform(get("/api/v1/scenarios/renting-an-apartment").header("Authorization", other))
        .andExpect(jsonPath("$.speakingScore").doesNotExist())
        .andExpect(jsonPath("$.completed").value(false));

    mvc.perform(
            put("/api/v1/scenarios/renting-an-apartment/speaking")
                .header("Authorization", mine)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"score\":101}"))
        .andExpect(status().isBadRequest());
    mvc.perform(
            put("/api/v1/scenarios/nope/speaking")
                .header("Authorization", mine)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"score\":50}"))
        .andExpect(status().isNotFound());
  }
}
