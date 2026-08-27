package com.vocabflow.security;

import com.vocabflow.shared.web.ApiErrorResponseFactory;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

@Component
public class JsonAccessDeniedHandler implements AccessDeniedHandler {
  private final ApiErrorResponseFactory responses;

  public JsonAccessDeniedHandler(ApiErrorResponseFactory responses) {
    this.responses = responses;
  }

  @Override
  public void handle(
      HttpServletRequest request,
      HttpServletResponse response,
      AccessDeniedException accessDeniedException)
      throws IOException {
    responses.write(response, HttpServletResponse.SC_FORBIDDEN, "FORBIDDEN", "Access is denied");
  }
}
