package com.vocabflow.vocabulary.domain;

import java.util.List;

/** One meaning of a word. {@code label} tells it from the word's other meanings. */
public record VocabularySense(
    String partOfSpeech,
    String label,
    String phonetic,
    String definition,
    List<String> examples,
    List<String> collocations) {

  /** The senses to show: the stored ones, or a single one made from an older one-meaning entry. */
  public static List<VocabularySense> orSingle(
      List<VocabularySense> senses,
      String partOfSpeech,
      String phonetic,
      String definition,
      List<String> examples,
      List<String> collocations) {
    if (senses != null && !senses.isEmpty()) {
      return senses;
    }
    return definition == null
        ? List.of()
        : List.of(
            new VocabularySense(partOfSpeech, null, phonetic, definition, examples, collocations));
  }
}
