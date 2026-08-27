package com.vocabflow.shared.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Instant;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;

@Component
public class ApiErrorResponseFactory {
  private final ObjectMapper objectMapper;

  public ApiErrorResponseFactory(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  public ResponseEntity<ApiError> response(HttpStatusCode status, String code, String message) {
    return ResponseEntity.status(status).body(create(code, message));
  }

  public void write(HttpServletResponse response, int status, String code, String message)
      throws IOException {
    response.setStatus(status);
    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
    objectMapper.writeValue(response.getOutputStream(), create(code, message));
  }

  private ApiError create(String code, String message) {
    return new ApiError(code, message, Instant.now());
  }
}
