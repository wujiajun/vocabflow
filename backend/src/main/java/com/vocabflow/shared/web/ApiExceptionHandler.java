package com.vocabflow.shared.web;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class ApiExceptionHandler {
  private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

  private final ApiErrorResponseFactory responses;

  public ApiExceptionHandler(ApiErrorResponseFactory responses) {
    this.responses = responses;
  }

  @ExceptionHandler(BadRequestException.class)
  ResponseEntity<ApiError> b(BadRequestException x) {
    return responses.response(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", x.getMessage());
  }

  @ExceptionHandler(ConflictException.class)
  ResponseEntity<ApiError> c(ConflictException x) {
    return responses.response(HttpStatus.CONFLICT, "CONFLICT", x.getMessage());
  }

  @ExceptionHandler(NotFoundException.class)
  ResponseEntity<ApiError> n(NotFoundException x) {
    return responses.response(HttpStatus.NOT_FOUND, "NOT_FOUND", x.getMessage());
  }

  @ExceptionHandler({UnauthorizedException.class})
  ResponseEntity<ApiError> u(RuntimeException x) {
    return responses.response(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", x.getMessage());
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  ResponseEntity<ApiError> v(MethodArgumentNotValidException x) {
    return responses.response(
        HttpStatus.BAD_REQUEST,
        "VALIDATION_ERROR",
        x.getBindingResult().getFieldError().getDefaultMessage());
  }

  @ExceptionHandler(IllegalArgumentException.class)
  ResponseEntity<ApiError> illegalArgument(IllegalArgumentException x) {
    return responses.response(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", x.getMessage());
  }

  @ExceptionHandler(HttpMessageNotReadableException.class)
  ResponseEntity<ApiError> unreadableBody(HttpMessageNotReadableException x) {
    return responses.response(
        HttpStatus.BAD_REQUEST, "MALFORMED_REQUEST", "Request body is missing or malformed");
  }

  @ExceptionHandler(MethodArgumentTypeMismatchException.class)
  ResponseEntity<ApiError> parameterTypeMismatch(MethodArgumentTypeMismatchException x) {
    return responses.response(
        HttpStatus.BAD_REQUEST,
        "INVALID_PARAMETER",
        "Invalid value for parameter '" + x.getName() + "'");
  }

  @ExceptionHandler(NoResourceFoundException.class)
  ResponseEntity<ApiError> noResource(NoResourceFoundException x) {
    return responses.response(HttpStatus.NOT_FOUND, "NOT_FOUND", "Resource not found");
  }

  @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
  ResponseEntity<ApiError> methodNotSupported(HttpRequestMethodNotSupportedException x) {
    ResponseEntity<ApiError> response =
        responses.response(
            HttpStatus.METHOD_NOT_ALLOWED,
            "METHOD_NOT_ALLOWED",
            "Method '" + x.getMethod() + "' is not supported");
    return ResponseEntity.status(response.getStatusCode())
        .headers(x.getHeaders())
        .body(response.getBody());
  }

  @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
  ResponseEntity<ApiError> mediaTypeNotSupported(HttpMediaTypeNotSupportedException x) {
    return responses.response(
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        "UNSUPPORTED_MEDIA_TYPE",
        "Content type is not supported");
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<ApiError> x(Exception x, HttpServletRequest request) {
    log.error("Unhandled exception on {} {}", request.getMethod(), request.getRequestURI(), x);
    return responses.response(
        HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "An unexpected error occurred");
  }
}
