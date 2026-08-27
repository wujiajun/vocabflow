package com.vocabflow.security;

import com.vocabflow.shared.web.ApiErrorResponseFactory;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

@Component
public class JsonAuthenticationEntryPoint implements AuthenticationEntryPoint {
  private final ApiErrorResponseFactory responses;

  public JsonAuthenticationEntryPoint(ApiErrorResponseFactory responses) {
    this.responses = responses;
  }

  @Override
  public void commence(
      HttpServletRequest request,
      HttpServletResponse response,
      AuthenticationException authenticationException)
      throws IOException {
    responses.write(
        response,
        HttpServletResponse.SC_UNAUTHORIZED,
        "UNAUTHORIZED",
        "Authentication is required");
  }
}
