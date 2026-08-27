package com.vocabflow.vocabulary.domain;

import java.time.Instant;

public record UserVocabulary(
    long id, long userId, VocabularyItem item, LearningStatus learningStatus, Instant createdAt) {}
