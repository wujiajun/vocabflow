package com.vocabflow.vocabulary.domain;

import java.util.List;

/** The single-value fields hold the first sense, so a list can show one summary line per word. */
public record EnrichmentResult(
    VocabularyType type,
    String phonetic,
    String partOfSpeech,
    String definition,
    List<String> examples,
    List<String> collocations,
    List<VocabularySense> senses) {
  public EnrichmentResult(
      VocabularyType type,
      String phonetic,
      String partOfSpeech,
      String definition,
      List<String> examples,
      List<String> collocations) {
    this(
        type,
        phonetic,
        partOfSpeech,
        definition,
        examples,
        collocations,
        List.of(
            new VocabularySense(partOfSpeech, null, phonetic, definition, examples, collocations)));
  }

  public static EnrichmentResult ofSenses(VocabularyType type, List<VocabularySense> senses) {
    VocabularySense first = senses.getFirst();
    return new EnrichmentResult(
        type,
        first.phonetic(),
        first.partOfSpeech(),
        first.definition(),
        first.examples(),
        first.collocations(),
        senses);
  }
}
