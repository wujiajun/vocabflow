package com.vocabflow.reading.application;

/** The daily allowance of model calls, shared with word details. */
public interface ModelQuota {
  /** Uses one call of the user's allowance for today; false when none is left. */
  boolean tryConsume(long userId);
}
