package com.vocabflow.reading.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class ReadingWordPickerTest {
  @Test
  void takesWordsTheLearnerStruggledWithFirstThenThoseStillBeingLearned() {
    List<StudiedWord> words =
        List.of(
            word("easy one", false, false),
            word("learning one", false, true),
            word("hard one", true, false),
            word("easy two", false, false),
            word("hard and learning", true, true));

    assertThat(ReadingWordPicker.pick(words, 3))
        .extracting(StudiedWord::term)
        .containsExactly("hard one", "hard and learning", "learning one");
  }

  @Test
  void keepsTheStudyOrderWithinAGroupAndAllWordsWhenThereAreFewEnough() {
    List<StudiedWord> words =
        IntStream.range(0, 4).mapToObj(i -> word("w" + i, false, false)).toList();

    assertThat(ReadingWordPicker.pick(words, 15))
        .extracting(StudiedWord::term)
        .containsExactly("w0", "w1", "w2", "w3");
  }

  private static StudiedWord word(String term, boolean struggled, boolean stillLearning) {
    return new StudiedWord(1, term, List.of("a meaning"), struggled, stillLearning);
  }
}
