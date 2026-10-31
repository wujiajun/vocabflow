package com.vocabflow.learning.application;

import com.vocabflow.learning.domain.ReviewCard;

/** A card as stored. {@code version} detects a rating based on an out-of-date view of the card. */
public record StoredCard(long userVocabularyId, ReviewCard card, int version) {}
