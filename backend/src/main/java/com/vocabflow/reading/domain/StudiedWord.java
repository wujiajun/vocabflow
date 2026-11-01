package com.vocabflow.reading.domain;

import java.util.List;

/**
 * A word rated on the day. {@code meanings} are the meanings the learner has seen, {@code
 * struggled} says the word was rated Again or Hard that day and {@code stillLearning} that it is
 * still in its learning steps.
 */
public record StudiedWord(
    long userVocabularyId,
    String term,
    List<String> meanings,
    boolean struggled,
    boolean stillLearning) {}
