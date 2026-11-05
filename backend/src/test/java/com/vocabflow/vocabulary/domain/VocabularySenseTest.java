package com.vocabflow.vocabulary.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class VocabularySenseTest {
  @Test
  void aMeaningWithoutSynonymsOrAntonymsHasEmptyListsNotNull() {
    VocabularySense sense =
        new VocabularySense(
            "noun", null, null, "A definition.", List.of("An example."), List.of(), null, null);

    assertThat(sense.synonyms()).isEmpty();
    assertThat(sense.antonyms()).isEmpty();
  }

  @Test
  void aSingleMeaningMadeFromAnOlderEntryHasNone() {
    List<VocabularySense> senses =
        VocabularySense.orSingle(
            List.of(), "noun", "/x/", "A definition.", List.of("An example."), List.of());

    assertThat(senses).singleElement().satisfies(sense -> assertThat(sense.synonyms()).isEmpty());
  }
}
