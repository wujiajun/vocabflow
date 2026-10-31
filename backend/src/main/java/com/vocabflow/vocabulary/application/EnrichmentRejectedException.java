package com.vocabflow.vocabulary.application;

/**
 * The provider answered, but the answer cannot be stored. The message names only the field or stop
 * reason, never the reply's content, so it is safe to log.
 */
public class EnrichmentRejectedException extends IllegalStateException {
  public EnrichmentRejectedException(String message) {
    super(message);
  }
}
