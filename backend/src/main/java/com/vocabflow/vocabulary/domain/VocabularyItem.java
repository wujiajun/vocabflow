package com.vocabflow.vocabulary.domain;

import java.time.Instant;
import java.util.List;

public record VocabularyItem(
    long id,
    VocabularyTerm term,
    VocabularyType type,
    String phonetic,
    String partOfSpeech,
    String definition,
    List<String> examples,
    List<String> collocations,
    EnrichmentStatus enrichmentStatus,
    String failureReason,
    Instant createdAt,
    List<VocabularySense> senses,
    String baseForm,
    String spellingSuggestion) {
  public VocabularyItem(
      long id,
      VocabularyTerm term,
      VocabularyType type,
      String phonetic,
      String partOfSpeech,
      String definition,
      List<String> examples,
      List<String> collocations,
      EnrichmentStatus enrichmentStatus,
      String failureReason,
      Instant createdAt,
      List<VocabularySense> senses) {
    this(
        id,
        term,
        type,
        phonetic,
        partOfSpeech,
        definition,
        examples,
        collocations,
        enrichmentStatus,
        failureReason,
        createdAt,
        senses,
        null,
        null);
  }

  public VocabularyItem(
      long id,
      VocabularyTerm term,
      VocabularyType type,
      String phonetic,
      String partOfSpeech,
      String definition,
      List<String> examples,
      List<String> collocations,
      EnrichmentStatus enrichmentStatus,
      String failureReason,
      Instant createdAt,
      List<VocabularySense> senses,
      String baseForm) {
    this(
        id,
        term,
        type,
        phonetic,
        partOfSpeech,
        definition,
        examples,
        collocations,
        enrichmentStatus,
        failureReason,
        createdAt,
        senses,
        baseForm,
        null);
  }

  public VocabularyItem(
      long id,
      VocabularyTerm term,
      VocabularyType type,
      String phonetic,
      String partOfSpeech,
      String definition,
      List<String> examples,
      List<String> collocations,
      EnrichmentStatus enrichmentStatus,
      String failureReason,
      Instant createdAt) {
    this(
        id,
        term,
        type,
        phonetic,
        partOfSpeech,
        definition,
        examples,
        collocations,
        enrichmentStatus,
        failureReason,
        createdAt,
        List.of(),
        null,
        null);
  }

  public List<VocabularySense> displaySenses() {
    return VocabularySense.orSingle(
        senses, partOfSpeech, phonetic, definition, examples, collocations);
  }
}
