package com.vocabflow.scenario.infrastructure;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vocabflow.scenario.application.ScenarioCatalog;
import com.vocabflow.scenario.domain.Scenario;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashSet;
import java.util.List;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/**
 * Reads the scenarios from {@code scenarios/catalog.json} on the classpath once, at startup. A file
 * that is not valid stops the application, so a bad edit is found when the tests run, not by a
 * learner.
 */
@Component
public class JsonScenarioCatalog implements ScenarioCatalog {
  private static final String PATH = "scenarios/catalog.json";

  @JsonIgnoreProperties(ignoreUnknown = true)
  record File(List<Scenario> scenarios) {}

  private final List<Scenario> scenarios;

  public JsonScenarioCatalog() {
    try (InputStream stream = new ClassPathResource(PATH).getInputStream()) {
      scenarios = parse(stream);
    } catch (IOException exception) {
      throw new IllegalStateException("Cannot read " + PATH, exception);
    }
  }

  static List<Scenario> parse(InputStream stream) throws IOException {
    ObjectMapper mapper =
        new ObjectMapper()
            .findAndRegisterModules()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    File file = mapper.readValue(stream, File.class);
    if (file.scenarios() == null || file.scenarios().isEmpty()) {
      throw new IllegalStateException("The scenario catalog has no scenarios");
    }
    var ids = new HashSet<String>();
    for (Scenario scenario : file.scenarios()) {
      if (!ids.add(scenario.id())) {
        throw new IllegalStateException("The scenario catalog lists " + scenario.id() + " twice");
      }
    }
    return List.copyOf(file.scenarios());
  }

  @Override
  public List<Scenario> scenarios() {
    return scenarios;
  }
}
