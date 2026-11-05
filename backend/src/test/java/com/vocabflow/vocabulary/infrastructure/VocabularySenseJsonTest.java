package com.vocabflow.vocabulary.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.vocabflow.vocabulary.domain.VocabularySense;
import java.util.List;
import org.junit.jupiter.api.Test;

class VocabularySenseJsonTest {
  @Test
  void meaningsStoredBeforeSynonymsExistedReadBackWithEmptyLists() {
    String stored =
        "[{\"partOfSpeech\":\"verb\",\"label\":\"start again\",\"phonetic\":\"/x/\","
            + "\"definition\":\"To begin again.\",\"examples\":[\"It will resume.\"],"
            + "\"collocations\":[\"resume work\"]}]";

    List<VocabularySense> senses = VocabularySenseJson.read(stored);

    assertThat(senses)
        .singleElement()
        .satisfies(
            sense -> {
              assertThat(sense.synonyms()).isEmpty();
              assertThat(sense.antonyms()).isEmpty();
            });
  }

  @Test
  void synonymsAndAntonymsSurviveAWriteAndRead() {
    VocabularySense sense =
        new VocabularySense(
            "verb",
            "start again",
            "/x/",
            "To begin again.",
            List.of("It will resume."),
            List.of(),
            List.of("restart"),
            List.of("stop"),
            "The talk starts again after lunch.",
            "▶️",
            "re- (again) + sume");

    VocabularySense back =
        VocabularySenseJson.read(VocabularySenseJson.write(List.of(sense))).getFirst();

    assertThat(back).isEqualTo(sense);
  }
}
