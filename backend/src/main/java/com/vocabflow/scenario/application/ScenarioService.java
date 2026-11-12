package com.vocabflow.scenario.application;

import com.vocabflow.scenario.application.ScenarioProgressRepository.Progress;
import com.vocabflow.scenario.domain.Scenario;
import com.vocabflow.shared.web.BadRequestException;
import com.vocabflow.shared.web.NotFoundException;
import java.time.Clock;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/**
 * Not transactional: finishing a scenario can lose a race to a duplicate key, which the adapter
 * catches, and that must not happen inside a caller's shared transaction.
 */
@Service
public class ScenarioService {
  public record Entry(Scenario scenario, Progress progress) {}

  private final ScenarioCatalog catalog;
  private final ScenarioProgressRepository progress;
  private final Clock clock;

  public ScenarioService(
      ScenarioCatalog catalog, ScenarioProgressRepository progress, Clock clock) {
    this.catalog = catalog;
    this.progress = progress;
    this.clock = clock;
  }

  public List<Entry> list(long userId) {
    Map<String, Progress> done = progress.progress(userId);
    return catalog.scenarios().stream().map(s -> new Entry(s, done.get(s.id()))).toList();
  }

  public Entry get(long userId, String id) {
    Scenario scenario =
        catalog.scenario(id).orElseThrow(() -> new NotFoundException("Scenario was not found"));
    return new Entry(scenario, progress.progress(userId).get(id));
  }

  /** {@code score} is the number of right answers, or null when the quiz was not taken. */
  public void complete(long userId, String id, Integer score) {
    Scenario scenario =
        catalog.scenario(id).orElseThrow(() -> new NotFoundException("Scenario was not found"));
    if (score != null && (score < 0 || score > scenario.quiz().size())) {
      throw new BadRequestException("The score does not fit the quiz");
    }
    progress.complete(userId, id, clock.instant(), score);
  }

  /** {@code score} is the share of the learner's words said right in Speak this scene, 0 to 100. */
  public void recordSpeaking(long userId, String id, Integer score) {
    catalog.scenario(id).orElseThrow(() -> new NotFoundException("Scenario was not found"));
    if (score == null || score < 0 || score > 100) {
      throw new BadRequestException("The speaking score must be 0 to 100");
    }
    progress.recordSpeaking(userId, id, clock.instant(), score);
  }
}
