package com.vocabflow.security;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vocabflow.shared.web.ApiErrorResponseFactory;
import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.InsufficientAuthenticationException;

class JsonSecurityResponseTest {
  private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();
  private final ApiErrorResponseFactory responses = new ApiErrorResponseFactory(objectMapper);
  private final JsonAuthenticationEntryPoint entryPoint =
      new JsonAuthenticationEntryPoint(responses);
  private final JsonAccessDeniedHandler accessDeniedHandler =
      new JsonAccessDeniedHandler(responses);

  @Test
  void writesUnauthorizedJsonResponse() throws Exception {
    MockHttpServletResponse response = new MockHttpServletResponse();

    entryPoint.commence(
        new MockHttpServletRequest(),
        response,
        new InsufficientAuthenticationException("Authentication is required"));

    assertThat(response.getStatus()).isEqualTo(401);
    assertThat(response.getContentAsString()).contains("\"code\":\"UNAUTHORIZED\"");
    assertApiErrorSchema(response);
  }

  @Test
  void writesForbiddenJsonResponse() throws Exception {
    MockHttpServletResponse response = new MockHttpServletResponse();

    accessDeniedHandler.handle(
        new MockHttpServletRequest(), response, new AccessDeniedException("Access is denied"));

    assertThat(response.getStatus()).isEqualTo(403);
    assertThat(response.getContentAsString()).contains("\"code\":\"FORBIDDEN\"");
    assertApiErrorSchema(response);
  }

  private void assertApiErrorSchema(MockHttpServletResponse response) throws Exception {
    Set<String> fields = new HashSet<>();
    objectMapper.readTree(response.getContentAsString()).fieldNames().forEachRemaining(fields::add);

    assertThat(fields).containsExactlyInAnyOrder("code", "message", "timestamp");
  }
}
