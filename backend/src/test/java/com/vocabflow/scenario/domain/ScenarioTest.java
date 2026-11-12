package com.vocabflow.scenario.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import org.junit.jupiter.api.Test;

class ScenarioTest {
  private static Scenario scenario(String text, String keyword) {
    return new Scenario(
        "demo",
        "Demo",
        "演示",
        6,
        2,
        "S",
        "概要",
        "",
        List.of(),
        List.of(
            new Segment("scene", "A scene.", null),
            new Segment("dialogue", null, List.of(new Segment.Line("Ann", text)))),
        List.of(new Keyword(keyword, "中", "d", "e")),
        List.of(new QuizQuestion("Q?", List.of("a", "b"), 1, "")));
  }

  @Test
  void theReaderGetsOneParagraphPerLine() {
    assertThat(scenario("Hello there.", "hello").text()).isEqualTo("A scene.\n\nAnn: Hello there.");
  }

  @Test
  void aKeywordMustBeInTheText() {
    assertThatThrownBy(() -> scenario("Hello there.", "goodbye"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("goodbye");
  }

  @Test
  void pricesAndPhoneNumbersAreRefused() {
    assertThatThrownBy(() -> scenario("It costs $5 hello.", "hello"))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> scenario("Call 555 1234 hello.", "hello"))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void aQuestionNeedsARightAnswerAmongItsOptions() {
    assertThatThrownBy(() -> new QuizQuestion("Q?", List.of("a", "b"), 2, ""))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> new QuizQuestion("Q?", List.of("a"), 0, ""))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void aSegmentOfAnUnknownKindIsRefused() {
    assertThatThrownBy(() -> new Segment("poem", "x", null))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
