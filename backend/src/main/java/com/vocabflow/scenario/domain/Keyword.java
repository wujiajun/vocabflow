package com.vocabflow.scenario.domain;

/** A word worth learning from a scenario: the English meaning, the Chinese one and an example. */
public record Keyword(String word, String zh, String definition, String example) {
  public Keyword {
    if (blank(word) || blank(zh) || blank(definition) || blank(example)) {
      throw new IllegalArgumentException(
          "A keyword needs the word, its Chinese meaning, a definition and an example");
    }
  }

  private static boolean blank(String value) {
    return value == null || value.isBlank();
  }
}
