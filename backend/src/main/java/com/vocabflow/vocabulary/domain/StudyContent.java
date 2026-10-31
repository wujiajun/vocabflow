package com.vocabflow.vocabulary.domain;

import java.util.List;

public record StudyContent(
    long userVocabularyId,
    long vocabularyItemId,
    String term,
    VocabularyType type,
    String phonetic,
    String partOfSpeech,
    String definition,
    List<String> examples,
    List<String> collocations,
    EnrichmentStatus enrichmentStatus,
    List<VocabularySense> senses) {}
