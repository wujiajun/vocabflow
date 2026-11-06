package com.vocabflow.vocabulary.domain;

import java.util.List;

/**
 * One meaning of a word. {@code label} tells it from the word's other meanings. {@code synonyms}
 * and {@code antonyms} belong to this meaning only and are never null, since a word stored before
 * they existed has none. {@code scene}, {@code emoji} and {@code parts} are the memory hook: a
 * one-sentence picture of this meaning, emoji that show it, and, on the first meaning only, how the
 * word is built from a known word and a common prefix or suffix. {@code chinese} is this meaning in
 * simple Chinese. Each is null when there is none.
 */
public record VocabularySense(
    String partOfSpeech,
    String label,
    String phonetic,
    String definition,
    List<String> examples,
    List<String> collocations,
    List<String> synonyms,
    List<String> antonyms,
    String scene,
    String emoji,
    String parts,
    String chinese) {

  public VocabularySense {
    synonyms = synonyms == null ? List.of() : synonyms;
    antonyms = antonyms == null ? List.of() : antonyms;
  }

  /** The senses to show: the stored ones, or a single one made from an older one-meaning entry. */
  public static List<VocabularySense> orSingle(
      List<VocabularySense> senses,
      String partOfSpeech,
      String phonetic,
      String definition,
      List<String> examples,
      List<String> collocations) {
    if (senses != null && !senses.isEmpty()) {
      return senses;
    }
    return definition == null
        ? List.of()
        : List.of(
            new VocabularySense(
                partOfSpeech,
                null,
                phonetic,
                definition,
                examples,
                collocations,
                List.of(),
                List.of(),
                null,
                null,
                null,
                null));
  }
}
