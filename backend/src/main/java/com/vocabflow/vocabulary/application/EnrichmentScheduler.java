package com.vocabflow.vocabulary.application;

public interface EnrichmentScheduler {
  /** Runs the task in the background; false when it could not be accepted. */
  boolean schedule(Runnable task);
}
