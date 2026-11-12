package com.vocabflow.scenario.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.vocabflow.scenario.domain.Keyword;
import com.vocabflow.scenario.domain.QuizQuestion;
import com.vocabflow.scenario.domain.Scenario;
import com.vocabflow.scenario.domain.Segment;
import com.vocabflow.shared.web.BadRequestException;
import com.vocabflow.shared.web.NotFoundException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ScenarioServiceTest {
  private static final Scenario DEMO =
      new Scenario(
          "demo",
          "Demo",
          "演示",
          6,
          2,
          "S",
          "概",
          "",
          List.of(),
          List.of(new Segment("scene", "Hello there.", null)),
          List.of(new Keyword("hello", "你好", "d", "e")),
          List.of(
              new QuizQuestion("Q1?", List.of("a", "b"), 0, ""),
              new QuizQuestion("Q2?", List.of("a", "b"), 1, "")));

  private final ScenarioCatalog catalog = () -> List.of(DEMO);
  private final Map<Long, Map<String, ScenarioProgressRepository.Progress>> rows = new HashMap<>();
  private final ScenarioProgressRepository repository =
      new ScenarioProgressRepository() {
        public Map<String, Progress> progress(long userId) {
          return rows.getOrDefault(userId, Map.of());
        }

        public void complete(long userId, String scenarioId, Instant at, Integer score) {
          var mine = rows.computeIfAbsent(userId, id -> new HashMap<>());
          Progress old = mine.get(scenarioId);
          Integer best =
              old == null || old.bestScore() == null
                  ? score
                  : score == null ? old.bestScore() : Math.max(old.bestScore(), score);
          mine.put(scenarioId, new Progress(old == null ? at : old.completedAt(), best));
        }
      };
  private final ScenarioService service =
      new ScenarioService(
          catalog, repository, Clock.fixed(Instant.parse("2025-05-01T00:00:00Z"), ZoneOffset.UTC));

  @Test
  void progressIsKeptPerUser() {
    service.complete(1, "demo", 1);

    assertThat(service.get(1, "demo").progress().bestScore()).isEqualTo(1);
    assertThat(service.get(1, "demo").progress().completedAt())
        .isEqualTo(Instant.parse("2025-05-01T00:00:00Z"));
    assertThat(service.get(2, "demo").progress()).isNull();
    assertThat(service.list(2).getFirst().progress()).isNull();
  }

  @Test
  void theBestScoreIsKeptAndTheFirstDateStays() {
    service.complete(1, "demo", 1);
    service.complete(1, "demo", 2);
    service.complete(1, "demo", 0);
    service.complete(1, "demo", null);

    assertThat(service.get(1, "demo").progress().bestScore()).isEqualTo(2);
  }

  @Test
  void unknownScenariosAreNotFoundAndImpossibleScoresRefused() {
    assertThatThrownBy(() -> service.get(1, "nope")).isInstanceOf(NotFoundException.class);
    assertThatThrownBy(() -> service.complete(1, "nope", null))
        .isInstanceOf(NotFoundException.class);
    assertThatThrownBy(() -> service.complete(1, "demo", 3))
        .isInstanceOf(BadRequestException.class);
    assertThatThrownBy(() -> service.complete(1, "demo", -1))
        .isInstanceOf(BadRequestException.class);
  }
}
