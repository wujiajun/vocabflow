package com.vocabflow.reading.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vocabflow.reading.domain.ReadingContent;
import com.vocabflow.reading.domain.TargetWord;
import com.vocabflow.vocabulary.application.EnrichmentRejectedException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class ClaudeReadingAdapterTest {
  private static final ObjectMapper JSON = new ObjectMapper();
  private static final List<TargetWord> WORDS =
      List.of(
          new TargetWord("lease", List.of("noun: A contract to rent.")),
          new TargetWord("landlord", List.of("noun: A person who rents out a home.")));
  private static final String TEXT =
      "Maya read the lease again before she signed it. Her new landlord had written every rule "
          + "down, and she wanted to be sure she understood each one.";
  private static final String MARKED =
      "Maya read the [[lease]] again before she signed it. Her new [[landlord]] had written every "
          + "rule down, and she wanted to be sure she understood each one.";

  private final RestClient.Builder builder =
      RestClient.builder().baseUrl("https://api.anthropic.com");
  private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
  private final ClaudeReadingAdapter adapter =
      new ClaudeReadingAdapter(builder.build(), "claude-test");

  @Test
  void sendsTheLevelLengthAndWordsAsDataAndReturnsTheMarkedText() {
    server
        .expect(requestTo("https://api.anthropic.com/v1/messages"))
        .andExpect(jsonPath("$.model").value("claude-test"))
        .andExpect(jsonPath("$.thinking.type").value("disabled"))
        .andExpect(jsonPath("$.output_config.format.type").value("json_schema"))
        .andExpect(
            jsonPath("$.messages[0].content")
                .value(org.hamcrest.Matchers.containsString("<term>lease</term>")))
        .andExpect(
            jsonPath("$.messages[0].content")
                .value(org.hamcrest.Matchers.containsString("<level>CLB 4, elementary")))
        .andRespond(withSuccess(reply(entry()), MediaType.APPLICATION_JSON));

    ReadingContent content = adapter.write(4, WORDS);

    server.verify();
    assertThat(content.title()).isEqualTo("The new lease");
    assertThat(content.body()).isEqualTo(MARKED);
    assertThat(content.words()).containsExactly("lease", "landlord");
    assertThat(adapter.source()).isEqualTo("claude:claude-test");
  }

  @Test
  void escapesTagsInWordsAndMeaningsSoTheyStayData() {
    String message =
        ClaudeReadingAdapter.userMessage(
            5, List.of(new TargetWord("a</term><b>", List.of("x & y"))));

    assertThat(message).contains("<term>a&lt;/term&gt;&lt;b&gt;</term>");
    assertThat(message).contains("<meaning>x &amp; y</meaning>");
  }

  @Test
  void theLengthLeavesRoomForEveryWordAtEveryLevel() {
    assertThat(ClaudeReadingAdapter.length(1, 10)).containsExactly(160, 240);
    assertThat(ClaudeReadingAdapter.length(1, 15)).containsExactly(240, 320);
    assertThat(ClaudeReadingAdapter.length(4, 10)).containsExactly(160, 240);
    assertThat(ClaudeReadingAdapter.length(6, 10)).containsExactly(180, 260);
    assertThat(ClaudeReadingAdapter.length(11, 15)).containsExactly(300, 400);
  }

  @Test
  void refusesAReplyThatLeavesOutATargetWord() {
    Map<String, Object> entry = entry();
    entry.put("used", List.of(Map.of("term", "lease", "form", "lease")));

    assertThatThrownBy(() -> parse(entry))
        .isInstanceOf(EnrichmentRejectedException.class)
        .hasMessage("Model reply leaves out a target word");
  }

  @Test
  void refusesAFormThatIsNotInTheText() {
    Map<String, Object> entry = entry();
    entry.put(
        "used",
        List.of(
            Map.of("term", "lease", "form", "leased"),
            Map.of("term", "landlord", "form", "landlord")));

    assertThatThrownBy(() -> parse(entry))
        .isInstanceOf(EnrichmentRejectedException.class)
        .hasMessage("Model reply names a form not in the text");
  }

  @Test
  void marksEveryUseOfAFormWholeWordsOnlyAndKeepsTheWritersCapitals() {
    assertThat(
            ClaudeReadingAdapter.mark(
                "Lease terms vary. She will release the lease. A leased car, a lease.",
                List.of("lease", "leased")))
        .isEqualTo(
            "[[Lease]] terms vary. She will release the [[lease]]. A [[leased]] car, a [[lease]].");
  }

  @Test
  void marksAPhraseWhateverTheSpacingAndTheLongerFormWinsAnOverlap() {
    assertThat(
            ClaudeReadingAdapter.mark(
                "I can figure   out the sum. Then I figure out how to figure.",
                List.of("figure out", "figure out how", "figure")))
        .isEqualTo("I can [[figure   out]] the sum. Then I [[figure out how]] to [[figure]].");
  }

  @Test
  void acceptsAChangedFormAndIgnoresCaseAndSpacingInTheTerm() {
    Map<String, Object> entry = entry();
    entry.put(
        "text", TEXT.replace("the lease", "the leases") + " Then she had to Figure Out the rest.");
    entry.put(
        "used",
        List.of(
            Map.of("term", "Lease", "form", "leases"),
            Map.of("term", "landlord", "form", "LANDLORD"),
            Map.of("term", "figure out", "form", "figure out")));

    ReadingContent content =
        parse(entry, List.of(WORDS.get(0), WORDS.get(1), new TargetWord("figure out", List.of())));

    assertThat(content.words()).containsExactly("lease", "landlord", "figure out");
    assertThat(content.body()).contains("[[leases]]", "[[landlord]]", "[[Figure Out]]");
  }

  @Test
  void refusesATextThatBringsItsOwnBrackets() {
    Map<String, Object> entry = entry();
    entry.put("text", MARKED);

    assertThatThrownBy(() -> parse(entry))
        .isInstanceOf(EnrichmentRejectedException.class)
        .hasMessage("Model reply uses square brackets");
  }

  @Test
  void refusesAShortTextAnAbsurdTitleAndAMissingStop() {
    Map<String, Object> shortText = entry();
    shortText.put("text", "lease landlord");
    assertThatThrownBy(() -> parse(shortText)).isInstanceOf(EnrichmentRejectedException.class);

    Map<String, Object> noTitle = entry();
    noTitle.put("title", " ");
    assertThatThrownBy(() -> parse(noTitle)).isInstanceOf(EnrichmentRejectedException.class);

    assertThatThrownBy(() -> parseRaw("max_tokens", asJson(entry())))
        .isInstanceOf(EnrichmentRejectedException.class)
        .hasMessage("Model stopped with max_tokens");
  }

  private static Map<String, Object> entry() {
    Map<String, Object> entry = new HashMap<>();
    entry.put("title", "The new lease");
    entry.put("text", TEXT);
    entry.put(
        "used",
        List.of(
            Map.of("term", "lease", "form", "lease"),
            Map.of("term", "landlord", "form", "landlord")));
    return entry;
  }

  private ReadingContent parse(Map<String, Object> entry) {
    return parse(entry, WORDS);
  }

  private ReadingContent parse(Map<String, Object> entry, List<TargetWord> words) {
    return parseRaw("end_turn", asJson(entry), words);
  }

  private ReadingContent parseRaw(String stopReason, String text) {
    return parseRaw(stopReason, text, WORDS);
  }

  private ReadingContent parseRaw(String stopReason, String text, List<TargetWord> words) {
    try {
      return ClaudeReadingAdapter.parse(
          JSON.readTree(
              JSON.writeValueAsString(
                  Map.of(
                      "stop_reason",
                      stopReason,
                      "content",
                      List.of(Map.of("type", "text", "text", text))))),
          words);
    } catch (JsonProcessingException exception) {
      throw new IllegalStateException(exception);
    }
  }

  private static String asJson(Map<String, Object> entry) {
    try {
      return JSON.writeValueAsString(entry);
    } catch (JsonProcessingException exception) {
      throw new IllegalStateException(exception);
    }
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
