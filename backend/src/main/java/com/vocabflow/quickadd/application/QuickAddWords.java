package com.vocabflow.quickadd.application;

/** Adds a word to a learner's list; implemented by the vocabulary module. */
public interface QuickAddWords {
  /** {@code added} is false when the word was already in the list. */
  record Result(String term, boolean added) {}

  Result add(long userId, String term);
}
