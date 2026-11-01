package com.vocabflow.vocabulary.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vocabflow.vocabulary.application.EnrichmentRejectedException;
import com.vocabflow.vocabulary.application.MisspelledTermException;
import com.vocabflow.vocabulary.domain.*;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

class ClaudeVocabularyEnrichmentAdapterTest {
  private static final ObjectMapper JSON = new ObjectMapper();
  private static final VocabularyTerm RESUME = new VocabularyTerm("resume");

  private final RestClient.Builder builder =
      RestClient.builder().baseUrl("https://api.anthropic.com");
  private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
  private final ClaudeVocabularyEnrichmentAdapter adapter =
      new ClaudeVocabularyEnrichmentAdapter(builder.build(), "claude-haiku-5-5");

  @Test
  void sendsOneRequestWithThinkingOffAndSchemaConstrainedOutputThenParsesEveryMeaning() {
    server
        .expect(requestTo("https://api.anthropic.com/v1/messages"))
        .andExpect(jsonPath("$.model").value("claude-haiku-5-5"))
        .andExpect(jsonPath("$.thinking.type").value("disabled"))
        .andExpect(jsonPath("$.messages[0].role").value("user"))
        .andExpect(jsonPath("$.messages[0].content").value("<term>resume</term>"))
        .andExpect(jsonPath("$.output_config.format.type").value("json_schema"))
        .andExpect(jsonPath("$.output_config.format.schema.required[0]").value("term"))
        .andRespond(withSuccess(reply(entry()), MediaType.APPLICATION_JSON));

    EnrichmentResult result = adapter.enrich(RESUME);

    server.verify();
    assertThat(result.type()).isEqualTo(VocabularyType.WORD);
    assertThat(result.senses()).hasSize(2);
    VocabularySense second = result.senses().get(1);
    assertThat(second.partOfSpeech()).isEqualTo("verb");
    assertThat(second.label()).isEqualTo("start again");
    assertThat(second.phonetic()).isEqualTo("/rɪˈzuːm/");
    assertThat(second.definition()).isEqualTo("To begin again.");
    assertThat(second.examples()).containsExactly("The meeting will resume.");
    assertThat(second.collocations()).containsExactly("resume work");
    assertThat(adapter.source()).isEqualTo("claude:claude-haiku-5-5");
  }

  @Test
  void theFirstMeaningFillsTheSummaryFields() {
    EnrichmentResult result = parse(entry());

    assertThat(result.definition()).isEqualTo("A document listing your experience.");
    assertThat(result.partOfSpeech()).isEqualTo("noun");
    assertThat(result.phonetic()).isEqualTo("/ˈrezəmeɪ/");
    assertThat(result.examples()).containsExactly("Send me your resume.");
  }

  @Test
  void refusesAnEntryForADifferentTerm() {
    Map<String, Object> entry = entry();
    entry.put("term", "call off");

    assertThatThrownBy(() -> parse(entry))
        .isInstanceOf(EnrichmentRejectedException.class)
        .hasMessage("Model reply describes a different term");
  }

  @Test
  void theTermMatchIgnoresCaseAndExtraSpacing() {
    Map<String, Object> entry = entry();
    entry.put("term", "  RESUME ");

    assertThat(parse(entry).senses()).hasSize(2);
  }

  @Test
  void refusesAMissingTerm() {
    Map<String, Object> entry = entry();
    entry.remove("term");

    assertThatThrownBy(() -> parse(entry)).isInstanceOf(EnrichmentRejectedException.class);
  }

  @Test
  void usesTheCapitalsTheModelGaveAndStillRefusesAnyOtherLetters() {
    Map<String, Object> entry = entry();
    entry.put("term", "resume");
    assertThat(parseRaw("end_turn", asJson(entry)).term()).isEqualTo("resume");

    entry.put("term", "  Resume ");
    assertThat(parseRaw("end_turn", asJson(entry)).term()).isEqualTo("Resume");

    entry.put("term", "resumed");
    assertThatThrownBy(() -> parseRaw("end_turn", asJson(entry)))
        .isInstanceOf(EnrichmentRejectedException.class);
  }

  @Test
  void keepsTheBaseFormTheModelNamedForAnInflectedWord() {
    Map<String, Object> entry = entry();
    entry.put("term", "resumes");
    entry.put("baseForm", " Resume ");

    server
        .expect(requestTo("https://api.anthropic.com/v1/messages"))
        .andRespond(withSuccess(reply(entry), MediaType.APPLICATION_JSON));

    EnrichmentResult result = adapter.enrich(new VocabularyTerm("resumes"));

    assertThat(result.baseForm()).isEqualTo("Resume");
  }

  @Test
  void noBaseFormWhenTheModelLeftItEmptyOrNamedTheTextItself() {
    assertThat(parse(entry()).baseForm()).isNull();

    Map<String, Object> same = entry();
    same.put("baseForm", "  RESUME");
    assertThat(parse(same).baseForm()).isNull();
  }

  @Test
  void aMisspellingIsReportedWithTheCorrectSpellingInsteadOfBeingStored() {
    Map<String, Object> entry = entry();
    entry.put("term", "resume");
    entry.put("baseForm", "résumé");
    entry.put("misspelled", true);

    assertThatThrownBy(() -> parse(entry))
        .isInstanceOfSatisfying(
            MisspelledTermException.class,
            exception -> assertThat(exception.suggestion()).isEqualTo("résumé"));
  }

  @Test
  void aMisspellingWithoutADifferentSpellingIsRefused() {
    Map<String, Object> entry = entry();
    entry.put("misspelled", true);
    entry.put("baseForm", "");
    assertThatThrownBy(() -> parse(entry)).isInstanceOf(EnrichmentRejectedException.class);

    entry.put("baseForm", "RESUME");
    assertThatThrownBy(() -> parse(entry)).isInstanceOf(EnrichmentRejectedException.class);
  }

  @Test
  void refusesAReplyWithoutTheMisspelledFlag() {
    Map<String, Object> entry = entry();
    entry.remove("misspelled");

    assertThatThrownBy(() -> parse(entry)).isInstanceOf(EnrichmentRejectedException.class);
  }

  @Test
  void refusesAReplyWithoutABaseFormField() {
    Map<String, Object> entry = entry();
    entry.remove("baseForm");

    assertThatThrownBy(() -> parse(entry)).isInstanceOf(EnrichmentRejectedException.class);
  }

  @Test
  void thereIsNoLimitOnHowManyMeaningsAWordHas() {
    Map<String, Object> entry = entry();
    entry.put("senses", java.util.Collections.nCopies(12, sense("noun", "x")));

    assertThat(parse(entry).senses()).hasSize(12);
  }

  @Test
  void blankOptionalFieldsBecomeNull() {
    Map<String, Object> sense = sense(" ", " ");
    sense.put("phonetic", " ");
    Map<String, Object> entry = entry();
    entry.put("senses", List.of(sense));

    VocabularySense parsed = parse(entry).senses().getFirst();
    assertThat(parsed.partOfSpeech()).isNull();
    assertThat(parsed.label()).isNull();
    assertThat(parsed.phonetic()).isNull();
  }

  @Test
  void rejectsAnUnknownTypeOrNoMeanings() {
    Map<String, Object> badType = entry();
    badType.put("type", "SLANG");
    assertThatThrownBy(() -> parse(badType)).isInstanceOf(EnrichmentRejectedException.class);

    Map<String, Object> none = entry();
    none.put("senses", List.of());
    assertThatThrownBy(() -> parse(none)).isInstanceOf(EnrichmentRejectedException.class);
  }

  @Test
  void rejectsAMeaningWithMissingEmptyOrOverlongFields() {
    for (String field : List.of("definition", "examples", "label")) {
      Map<String, Object> sense = sense("noun", "x");
      sense.remove(field);
      assertRejected(sense);
    }
    Map<String, Object> blank = sense("noun", "x");
    blank.put("definition", " ");
    assertRejected(blank);
    Map<String, Object> overlong = sense("noun", "x");
    overlong.put("definition", "x".repeat(1001));
    assertRejected(overlong);
    Map<String, Object> longLabel = sense("noun", "x".repeat(61));
    assertRejected(longLabel);
    Map<String, Object> noExamples = sense("noun", "x");
    noExamples.put("examples", List.of());
    assertRejected(noExamples);
    Map<String, Object> tooMany = sense("noun", "x");
    tooMany.put("collocations", List.of("a", "b", "c", "d", "e", "f", "g", "h", "i"));
    assertRejected(tooMany);
  }

  @Test
  void rejectsAReplyThatIsNotJsonOrWasCutOffOrRefused() throws Exception {
    assertThatThrownBy(() -> parseRaw("end_turn", "not json"))
        .isInstanceOf(EnrichmentRejectedException.class);
    for (String stop : List.of("max_tokens", "refusal")) {
      assertThatThrownBy(() -> parseRaw(stop, JSON.writeValueAsString(entry())))
          .as(stop)
          .isInstanceOf(EnrichmentRejectedException.class);
    }
  }

  @Test
  void anHttpErrorSurfacesAsAnExceptionForTheServiceToRecordAsFailed() {
    server.expect(requestTo("https://api.anthropic.com/v1/messages")).andRespond(withServerError());

    assertThatThrownBy(() -> adapter.enrich(RESUME))
        .isInstanceOf(RestClientResponseException.class);
  }

  @Test
  void refusesToStartAsTheRealProviderWithoutAnApiKey() {
    assertThatThrownBy(() -> new ClaudeVocabularyEnrichmentAdapter(" ", "claude-haiku-5-5", 30))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("VOCABFLOW_ANTHROPIC_API_KEY");
  }

  private void assertRejected(Map<String, Object> sense) {
    Map<String, Object> entry = entry();
    entry.put("senses", List.of(sense));
    assertThatThrownBy(() -> parse(entry)).isInstanceOf(RuntimeException.class);
  }

  private static String asJson(Map<String, Object> entry) {
    try {
      return JSON.writeValueAsString(entry);
    } catch (JsonProcessingException exception) {
      throw new IllegalStateException(exception);
    }
  }

  private EnrichmentResult parse(Map<String, Object> entry) {
    try {
      return parseRaw("end_turn", JSON.writeValueAsString(entry));
    } catch (JsonProcessingException exception) {
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
                      List.of(Map.of("type", "text", "text", text))))),
          RESUME);
    } catch (JsonProcessingException exception) {
      throw new IllegalStateException(exception);
    }
  }

  private static Map<String, Object> entry() {
    Map<String, Object> first = new HashMap<>();
    first.put("partOfSpeech", "noun");
    first.put("label", "document");
    first.put("phonetic", "/ˈrezəmeɪ/");
    first.put("definition", "A document listing your experience.");
    first.put("examples", List.of("Send me your resume."));
    first.put("collocations", List.of("update a resume"));
    Map<String, Object> second = new HashMap<>();
    second.put("partOfSpeech", "verb");
    second.put("label", "start again");
    second.put("phonetic", "/rɪˈzuːm/");
    second.put("definition", "To begin again.");
    second.put("examples", List.of("The meeting will resume."));
    second.put("collocations", List.of("resume work"));
    Map<String, Object> entry = new HashMap<>();
    entry.put("term", "resume");
    entry.put("baseForm", "");
    entry.put("misspelled", false);
    entry.put("type", "WORD");
    entry.put("senses", List.of(first, second));
    return entry;
  }

  private static Map<String, Object> sense(String partOfSpeech, String label) {
    Map<String, Object> sense = new HashMap<>();
    sense.put("partOfSpeech", partOfSpeech);
    sense.put("label", label);
    sense.put("phonetic", "/x/");
    sense.put("definition", "A definition.");
    sense.put("examples", List.of("An example."));
    sense.put("collocations", List.of("a collocation"));
    return sense;
  }

  private static String reply(Map<String, Object> entry) {
    try {
      return JSON.writeValueAsString(
          Map.of(
              "stop_reason",
              "end_turn",
              "content",
              List.of(Map.of("type", "text", "text", JSON.writeValueAsString(entry)))));
    } catch (JsonProcessingException exception) {
      throw new IllegalStateException(exception);
    }
  }
}
