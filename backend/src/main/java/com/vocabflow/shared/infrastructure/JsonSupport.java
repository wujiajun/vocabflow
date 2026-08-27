package com.vocabflow.shared.infrastructure;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;

public final class JsonSupport {
  private static final ObjectMapper M = new ObjectMapper();

  private JsonSupport() {}

  public static String write(List<String> v) {
    try {
      return M.writeValueAsString(v);
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  public static List<String> read(String v) {
    try {
      return v == null ? List.of() : M.readValue(v, new TypeReference<>() {});
    } catch (Exception e) {
      return List.of();
    }
  }
}
