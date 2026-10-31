package com.vocabflow.vocabulary.infrastructure;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vocabflow.vocabulary.domain.VocabularySense;
import java.util.List;

final class VocabularySenseJson {
  private static final ObjectMapper JSON = new ObjectMapper();

  private VocabularySenseJson() {}

  static String write(List<VocabularySense> senses) {
    try {
      return JSON.writeValueAsString(senses);
    } catch (Exception exception) {
      throw new IllegalStateException(exception);
    }
  }

  static List<VocabularySense> read(String json) {
    if (json == null) {
      return List.of();
    }
    try {
      return JSON.readValue(json, new TypeReference<>() {});
    } catch (Exception exception) {
      throw new IllegalStateException(exception);
    }
  }
}
