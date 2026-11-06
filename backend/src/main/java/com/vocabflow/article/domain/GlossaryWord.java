package com.vocabflow.article.domain;

/** A word from an article's "Words in This Story" list, with VOA's short definition. */
public record GlossaryWord(String word, String definition) {
  public GlossaryWord {
    if (word == null || word.isBlank() || definition == null || definition.isBlank()) {
      throw new IllegalArgumentException("A glossary word needs the word and its definition");
    }
  }
}
