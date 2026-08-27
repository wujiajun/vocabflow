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
    Instant createdAt) {}
