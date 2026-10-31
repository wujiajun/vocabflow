package com.vocabflow.vocabulary.application;

import com.vocabflow.vocabulary.domain.*;

public interface VocabularyEnrichmentProvider {
  EnrichmentResult enrich(VocabularyTerm term);

  /** Recorded with the content so it can be traced back (and redone) later. */
  default String source() {
    return "unknown";
  }
}
