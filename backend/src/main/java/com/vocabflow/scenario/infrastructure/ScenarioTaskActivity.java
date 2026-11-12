package com.vocabflow.scenario.infrastructure;

import com.vocabflow.progress.application.ScenarioProgress;
import com.vocabflow.scenario.application.ScenarioCatalog;
import com.vocabflow.tasks.application.ScenarioActivity;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/** The scenarios as the daily tasks and the progress page count them. A user has few rows. */
@Component
public class ScenarioTaskActivity implements ScenarioActivity, ScenarioProgress {
  private final ScenarioProgressJpaRepository rows;
  private final ScenarioCatalog catalog;

  public ScenarioTaskActivity(ScenarioProgressJpaRepository rows, ScenarioCatalog catalog) {
    this.rows = rows;
    this.catalog = catalog;
  }

  @Override
  public int finishedBetween(long userId, Instant from, Instant to) {
    return (int)
        rows.findByUserId(userId).stream().filter(r -> within(r.completedAt, from, to)).count();
  }

  @Override
  public int spokenBetween(long userId, Instant from, Instant to) {
    return (int)
        rows.findByUserId(userId).stream().filter(r -> within(r.spokenAt, from, to)).count();
  }

  @Override
  public boolean unfinishedScenario(long userId) {
    Set<String> done =
        rows.findByUserId(userId).stream().map(r -> r.scenarioId).collect(Collectors.toSet());
    return catalog.scenarios().stream().anyMatch(s -> !done.contains(s.id()));
  }

  @Override
  public boolean speakableScenario() {
    return catalog.scenarios().stream()
        .anyMatch(s -> s.segments().stream().anyMatch(g -> "dialogue".equals(g.kind())));
  }

  @Override
  public Scenes scenes(long userId) {
    Set<String> offered = catalog.scenarios().stream().map(s -> s.id()).collect(Collectors.toSet());
    List<ScenarioProgressEntity> mine =
        rows.findByUserId(userId).stream().filter(r -> offered.contains(r.scenarioId)).toList();
    List<Integer> scores =
        mine.stream().map(r -> r.speakingScore).filter(score -> score != null).toList();
    Integer average =
        scores.isEmpty()
            ? null
            : (int) Math.round(scores.stream().mapToInt(Integer::intValue).average().orElse(0));
    return new Scenes(offered.size(), mine.size(), scores.size(), average);
  }

  private static boolean within(Instant at, Instant from, Instant to) {
    return at != null && !at.isBefore(from) && at.isBefore(to);
  }
}
