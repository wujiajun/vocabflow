package com.vocabflow.vocabulary.application;

/**
 * The provider found that the text is a misspelling of another word. There is nothing to store but
 * the correct spelling, which the user is offered instead.
 */
public class MisspelledTermException extends RuntimeException {
  private final String suggestion;

  public MisspelledTermException(String suggestion) {
    super("The term looks misspelled");
    this.suggestion = suggestion;
  }

  public String suggestion() {
    return suggestion;
  }
}
