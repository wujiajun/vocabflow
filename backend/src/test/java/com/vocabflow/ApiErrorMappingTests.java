package com.vocabflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vocabflow.vocabulary.application.VocabularyService;
import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@ExtendWith(OutputCaptureExtension.class)
class ApiErrorMappingTests {
  @Autowired private MockMvc mvc;
  @Autowired private ObjectMapper json;
  @MockitoBean private VocabularyService vocabularyService;

  @Test
  void malformedJsonReturnsBadRequest() throws Exception {
    assertError(
        mvc.perform(
            post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\": ")),
        400,
        "MALFORMED_REQUEST");
  }

  @Test
  void missingBodyReturnsBadRequest() throws Exception {
    assertError(
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)),
        400,
        "MALFORMED_REQUEST");
  }

  @Test
  void malformedBodyMessageDoesNotLeakParserDetails() throws Exception {
    mvc.perform(
            post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\": "))
        .andExpect(jsonPath("$.message").value("Request body is missing or malformed"));
  }

  @Test
  void invalidQueryParameterTypesReturnBadRequest() throws Exception {
    String token = token("mapping-params@example.com");
    assertError(
        mvc.perform(
            get("/api/v1/learning/daily-plan")
                .queryParam("date", "abc")
                .header("Authorization", "Bearer " + token)),
        400,
        "INVALID_PARAMETER");
    assertError(
        mvc.perform(
            get("/api/v1/vocabulary")
                .queryParam("page", "x")
                .header("Authorization", "Bearer " + token)),
        400,
        "INVALID_PARAMETER");
  }

  @Test
  void invalidPathVariableTypeReturnsBadRequest() throws Exception {
    String token = token("mapping-path@example.com");
    assertError(
        mvc.perform(get("/api/v1/vocabulary/abc").header("Authorization", "Bearer " + token)),
        400,
        "INVALID_PARAMETER");
  }

  @Test
  void unknownPathReturnsNotFound() throws Exception {
    String token = token("mapping-notfound@example.com");
    assertError(
        mvc.perform(get("/api/v1/does-not-exist").header("Authorization", "Bearer " + token)),
        404,
        "NOT_FOUND");
  }

  @Test
  void unsupportedMethodReturnsMethodNotAllowedWithAllowHeader() throws Exception {
    assertError(mvc.perform(get("/api/v1/auth/login")), 405, "METHOD_NOT_ALLOWED")
        .andExpect(header().string("Allow", "POST"));
  }

  @Test
  void unsupportedContentTypeReturnsUnsupportedMediaType() throws Exception {
    assertError(
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.TEXT_PLAIN).content("x")),
        415,
        "UNSUPPORTED_MEDIA_TYPE");
  }

  @Test
  void unexpectedExceptionReturnsInternalErrorAndLogsStackTrace(CapturedOutput output)
      throws Exception {
    String token = token("mapping-internal@example.com");
    when(vocabularyService.list(anyLong(), anyInt(), anyInt()))
        .thenThrow(new IllegalStateException("boom-secret-detail"));

    String body =
        assertError(
                mvc.perform(get("/api/v1/vocabulary").header("Authorization", "Bearer " + token)),
                500,
                "INTERNAL_ERROR")
            .andExpect(jsonPath("$.message").value("An unexpected error occurred"))
            .andReturn()
            .getResponse()
            .getContentAsString();

    assertThat(body).doesNotContain("boom-secret-detail");
    assertThat(output.getAll())
        .contains("ERROR")
        .contains("Unhandled exception on GET /api/v1/vocabulary")
        .contains("java.lang.IllegalStateException: boom-secret-detail")
        .contains("at com.vocabflow");
  }

  private ResultActions assertError(ResultActions result, int status, String code)
      throws Exception {
    result.andExpect(status().is(status)).andExpect(jsonPath("$.code").value(code));
    String body = result.andReturn().getResponse().getContentAsString();
    Set<String> fields = new HashSet<>();
    json.readTree(body).fieldNames().forEachRemaining(fields::add);
    assertThat(fields).containsExactlyInAnyOrder("code", "message", "timestamp");
    return result;
  }

  private String token(String email) throws Exception {
    mvc.perform(
            post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"email\":\""
                        + email
                        + "\",\"password\":\"password123\",\"clbLevel\":\"CLB_5\",\"dailyNewVocabularyGoal\":10}"))
        .andExpect(status().isOk());
    String response =
        mvc.perform(
                post("/api/v1/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"" + email + "\",\"password\":\"password123\"}"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return json.readTree(response).path("accessToken").asText();
  }
}
