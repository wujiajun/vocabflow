package com.vocabflow.reading.domain;

import java.util.Comparator;
import java.util.List;

/**
 * Chooses the words to practise: those the learner struggled with first, then those still being
 * learned, then the rest; within each group in the order they were studied.
 */
public final class ReadingWordPicker {
  private ReadingWordPicker() {}

  public static List<StudiedWord> pick(List<StudiedWord> words, int max) {
    return words.stream()
        .sorted(
            Comparator.comparingInt(
                (StudiedWord word) -> word.struggled() ? 0 : word.stillLearning() ? 1 : 2))
        .limit(max)
        .toList();
  }
}
