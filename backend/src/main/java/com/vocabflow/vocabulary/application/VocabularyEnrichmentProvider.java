package com.vocabflow.vocabulary.application;

import com.vocabflow.vocabulary.domain.*;

public interface VocabularyEnrichmentProvider {
  EnrichmentResult enrich(VocabularyTerm term);
}
