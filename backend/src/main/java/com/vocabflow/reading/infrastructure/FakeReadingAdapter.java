package com.vocabflow.reading.infrastructure;

import com.vocabflow.reading.application.ReadingProvider;
import com.vocabflow.reading.domain.ReadingContent;
import com.vocabflow.reading.domain.TargetWord;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Deterministic placeholder text, not AI: one marked sentence per word. */
@Component
@ConditionalOnProperty(
    name = "vocabflow.enrichment.provider",
    havingValue = "fake",
    matchIfMissing = true)
public class FakeReadingAdapter implements ReadingProvider {
  @Override
  public String source() {
    return "fake";
  }

  @Override
  public ReadingContent write(int clbLevel, List<TargetWord> words) {
    StringBuilder body = new StringBuilder();
    for (int i = 0; i < words.size(); i++) {
      body.append("This is a practice sentence with [[").append(words.get(i).term()).append("]].");
      body.append(i % 3 == 2 ? "\n\n" : " ");
    }
    return new ReadingContent(
        "Practice reading (level " + clbLevel + ")",
        body.toString().strip(),
        words.stream().map(TargetWord::term).toList());
  }
}
