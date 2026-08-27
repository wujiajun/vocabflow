package com.vocabflow.security;

import java.util.Optional;

public final class BearerTokenExtractor {
  private static final String BEARER_PREFIX = "Bearer ";

  private BearerTokenExtractor() {}

  public static Optional<String> extract(String authorization) {
    if (authorization == null || !authorization.startsWith(BEARER_PREFIX)) {
      return Optional.empty();
    }
    String token = authorization.substring(BEARER_PREFIX.length()).trim();
    return token.isEmpty() ? Optional.empty() : Optional.of(token);
  }
}
