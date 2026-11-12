package com.vocabflow.scenario.domain;

import java.util.List;

/** One multiple-choice question; {@code answer} is the index of the right option. */
public record QuizQuestion(String question, List<String> options, int answer, String explainZh) {
  public QuizQuestion {
    if (question == null || question.isBlank()) {
      throw new IllegalArgumentException("A question needs its text");
    }
    if (options == null
        || options.size() < 2
        || options.size() > 4
        || options.stream().anyMatch(o -> o == null || o.isBlank())) {
      throw new IllegalArgumentException("Question '" + question + "' needs 2 to 4 options");
    }
    if (answer < 0 || answer >= options.size()) {
      throw new IllegalArgumentException("Question '" + question + "' has no such right answer");
    }
    explainZh = explainZh == null ? "" : explainZh;
    options = List.copyOf(options);
  }
}
