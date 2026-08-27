package com.vocabflow.vocabulary.domain;

import java.util.List;

public record EnrichmentResult(
    VocabularyType type,
    String phonetic,
    String partOfSpeech,
    String definition,
    List<String> examples,
    List<String> collocations) {}
