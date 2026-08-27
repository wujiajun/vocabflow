package com.vocabflow.vocabulary.domain;

import java.time.Instant;

public record LearningVocabulary(
    long userVocabularyId,
    long vocabularyItemId,
    String term,
    VocabularyType type,
    Instant createdAt) {}
