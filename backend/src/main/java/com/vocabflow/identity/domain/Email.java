package com.vocabflow.identity.domain;

import java.util.Locale;

public record Email(String value) {
  public Email {
    if (value == null || !value.trim().matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"))
      throw new IllegalArgumentException("A valid email is required");
    value = value.trim().toLowerCase(Locale.ROOT);
  }
}
