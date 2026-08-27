package com.vocabflow.learning.domain;

import com.vocabflow.vocabulary.domain.VocabularyType;

public record DailyLearningPlanItem(
    long userVocabularyId,
    long vocabularyItemId,
    String term,
    VocabularyType type,
    PlanItemType itemType) {}
