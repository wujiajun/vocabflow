package com.vocabflow.learning.application;

import com.vocabflow.learning.domain.Rating;
import com.vocabflow.learning.domain.ReviewCard;
import java.time.Instant;
import java.time.LocalDate;

public record ReviewLogEntry(
    long userId,
    long userVocabularyId,
    Rating rating,
    ReviewCard before,
    ReviewCard after,
    LocalDate reviewDate,
    Instant reviewedAt) {}
