package com.vocabflow.vocabulary.domain;

import java.util.Locale;

public record VocabularyTerm(String value) {
  public VocabularyTerm {
    if (value == null || value.trim().isEmpty() || value.trim().length() > 255)
      throw new IllegalArgumentException("Term must contain 1 to 255 characters");
    value = value.trim().replaceAll("\\s+", " ");
  }

  public String normalized() {
    return value.toLowerCase(Locale.ROOT);
  }
}
