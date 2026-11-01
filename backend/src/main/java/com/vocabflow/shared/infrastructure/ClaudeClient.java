package com.vocabflow.shared.infrastructure;

import java.time.Duration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/** The HTTP client for the Claude Messages API, shared by the adapters that call it. */
public final class ClaudeClient {
  private ClaudeClient() {}

  public static RestClient create(String apiKey, int timeoutSeconds) {
    SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
    factory.setConnectTimeout(Duration.ofSeconds(5));
    factory.setReadTimeout(Duration.ofSeconds(timeoutSeconds));
    return RestClient.builder()
        .baseUrl("https://api.anthropic.com")
        .requestFactory(factory)
        .defaultHeader("x-api-key", apiKey)
        .defaultHeader("anthropic-version", "2023-06-01")
        .build();
  }
}
