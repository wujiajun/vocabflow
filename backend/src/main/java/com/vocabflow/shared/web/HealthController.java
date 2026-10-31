package com.vocabflow.shared.web;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Answers once the application has started, which includes its database migrations. */
@RestController
public class HealthController {
  @GetMapping("/api/v1/health")
  public Map<String, String> health() {
    return Map.of("status", "UP");
  }
}
