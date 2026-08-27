package com.vocabflow.learning.domain;

import com.vocabflow.vocabulary.domain.VocabularyType;

public record ReviewCandidate(
    long userVocabularyId, long vocabularyItemId, String term, VocabularyType type) {}
