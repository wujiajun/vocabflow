package com.vocabflow.reading.application;

import com.vocabflow.reading.domain.ReadingContent;
import com.vocabflow.reading.domain.TargetWord;
import java.util.List;

public interface ReadingProvider {
  /** The model or fixture the text came from, stored with it. */
  String source();

  /**
   * Writes a passage that uses every word, at the given CLB level. Throws {@code
   * EnrichmentRejectedException} when the answer cannot be used.
   */
  ReadingContent write(int clbLevel, List<TargetWord> words);
}
