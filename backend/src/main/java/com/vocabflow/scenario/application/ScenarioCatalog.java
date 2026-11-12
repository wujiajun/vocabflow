package com.vocabflow.scenario.application;

import com.vocabflow.scenario.domain.Scenario;
import java.util.List;
import java.util.Optional;

/** The scenarios the app offers, in the order they are listed. Read-only. */
public interface ScenarioCatalog {
  List<Scenario> scenarios();

  default Optional<Scenario> scenario(String id) {
    return scenarios().stream().filter(s -> s.id().equals(id)).findFirst();
  }
}
