package com.vocabflow.vocabulary.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vocabflow.vocabulary.domain.*;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

class ClaudeVocabularyEnrichmentAdapterTest {
  private static final ObjectMapper JSON = new ObjectMapper();

  private final RestClient.Builder builder =
      RestClient.builder().baseUrl("https://api.anthropic.com");
  private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
  private final ClaudeVocabularyEnrichmentAdapter adapter =
      new ClaudeVocabularyEnrichmentAdapter(builder.build(), "claude-haiku-5-5");

  @Test
  void sendsOneRequestWithThinkingOffAndSchemaConstrainedOutputThenParsesTheEntry() {
    server
        .expect(requestTo("https://api.anthropic.com/v1/messages"))
        .andExpect(jsonPath("$.model").value("claude-haiku-5-5"))
        .andExpect(jsonPath("$.thinking.type").value("disabled"))
        .andExpect(jsonPath("$.messages[0].role").value("user"))
        .andExpect(jsonPath("$.messages[0].content").value("Figure Out"))
        .andExpect(jsonPath("$.output_config.format.type").value("json_schema"))
        .andExpect(jsonPath("$.output_config.format.schema.required").isArray())
        .andRespond(withSuccess(reply(validEntry()), MediaType.APPLICATION_JSON));

    EnrichmentResult result = adapter.enrich(new VocabularyTerm("Figure Out"));

    server.verify();
    assertThat(result.type()).isEqualTo(VocabularyType.PHRASAL_VERB);
    assertThat(result.phonetic()).isEqualTo("/ˈfɪɡjər aʊt/");
    assertThat(result.partOfSpeech()).isEqualTo("phrasal verb");
    assertThat(result.definition()).isEqualTo("To understand or solve something.");
    assertThat(result.examples()).containsExactly("I need to figure out this problem.");
    assertThat(result.collocations()).containsExactly("figure out how", "figure it out");
    assertThat(adapter.source()).isEqualTo("claude:claude-haiku-5-5");
  }

  @Test
  void anEmptyPhoneticBecomesNull() {
    Map<String, Object> entry = validEntry();
    entry.put("phonetic", "  ");

    assertThat(parse(entry).phonetic()).isNull();
  }

  @Test
  void rejectsAnUnknownType() {
    Map<String, Object> entry = validEntry();
    entry.put("type", "SLANG");

    assertThatThrownBy(() -> parse(entry)).isInstanceOf(IllegalStateException.class);
  }

  @Test
  void rejectsMissingEmptyOrOverlongFields() {
    for (String field : List.of("partOfSpeech", "definition", "examples")) {
      Map<String, Object> missing = validEntry();
      missing.remove(field);
      assertThatThrownBy(() -> parse(missing))
          .as("missing " + field)
          .isInstanceOf(IllegalStateException.class);
    }
    Map<String, Object> blank = validEntry();
    blank.put("definition", " ");
    assertThatThrownBy(() -> parse(blank)).isInstanceOf(IllegalStateException.class);
    Map<String, Object> overlong = validEntry();
    overlong.put("definition", "x".repeat(1001));
    assertThatThrownBy(() -> parse(overlong)).isInstanceOf(IllegalStateException.class);
    Map<String, Object> noExamples = validEntry();
    noExamples.put("examples", List.of());
    assertThatThrownBy(() -> parse(noExamples)).isInstanceOf(IllegalStateException.class);
    Map<String, Object> tooMany = validEntry();
    tooMany.put("collocations", List.of("a", "b", "c", "d", "e", "f", "g", "h", "i"));
    assertThatThrownBy(() -> parse(tooMany)).isInstanceOf(IllegalStateException.class);
    Map<String, Object> badElement = validEntry();
    badElement.put("examples", List.of(" "));
    assertThatThrownBy(() -> parse(badElement)).isInstanceOf(IllegalStateException.class);
  }

  @Test
  void rejectsAReplyThatIsNotJsonOrWasCutOffOrRefused() throws Exception {
    assertThatThrownBy(() -> parseRaw("end_turn", "not json"))
        .isInstanceOf(IllegalStateException.class);
    for (String stop : List.of("max_tokens", "refusal")) {
      assertThatThrownBy(() -> parseRaw(stop, JSON.writeValueAsString(validEntry())))
          .as(stop)
          .isInstanceOf(IllegalStateException.class);
    }
  }

  @Test
  void anHttpErrorSurfacesAsAnExceptionForTheServiceToRecordAsFailed() {
    server.expect(requestTo("https://api.anthropic.com/v1/messages")).andRespond(withServerError());

    assertThatThrownBy(() -> adapter.enrich(new VocabularyTerm("x")))
        .isInstanceOf(RestClientResponseException.class);
  }

  @Test
  void refusesToStartAsTheRealProviderWithoutAnApiKey() {
    assertThatThrownBy(() -> new ClaudeVocabularyEnrichmentAdapter(" ", "claude-haiku-5-5", 30))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("VOCABFLOW_ANTHROPIC_API_KEY");
  }

  private EnrichmentResult parse(Map<String, Object> entry) {
    try {
      return parseRaw("end_turn", JSON.writeValueAsString(entry));
    } catch (com.fasterxml.jackson.core.JsonProcessingException exception) {
      throw new IllegalStateException(exception);
    }
  }

  private EnrichmentResult parseRaw(String stopReason, String text) {
    try {
      return ClaudeVocabularyEnrichmentAdapter.parse(
          JSON.readTree(
              JSON.writeValueAsString(
                  Map.of(
                      "stop_reason",
                      stopReason,
                      "content",
                      List.of(Map.of("type", "text", "text", text))))));
    } catch (com.fasterxml.jackson.core.JsonProcessingException exception) {
      throw new IllegalStateException(exception);
    }
  }

  private static Map<String, Object> validEntry() {
    Map<String, Object> entry = new java.util.HashMap<>();
    entry.put("type", "PHRASAL_VERB");
    entry.put("phonetic", "/ˈfɪɡjər aʊt/");
    entry.put("partOfSpeech", "phrasal verb");
    entry.put("definition", "To understand or solve something.");
    entry.put("examples", List.of("I need to figure out this problem."));
    entry.put("collocations", List.of("figure out how", "figure it out"));
    return entry;
  }

  private static String reply(Map<String, Object> entry) {
    try {
      return JSON.writeValueAsString(
          Map.of(
              "stop_reason",
              "end_turn",
              "content",
              List.of(Map.of("type", "text", "text", JSON.writeValueAsString(entry)))));
    } catch (com.fasterxml.jackson.core.JsonProcessingException exception) {
      throw new IllegalStateException(exception);
    }
  }
}
