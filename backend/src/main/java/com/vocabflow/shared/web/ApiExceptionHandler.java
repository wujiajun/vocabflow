package com.vocabflow.shared.web;

import org.springframework.http.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

@RestControllerAdvice
public class ApiExceptionHandler {
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

  @ExceptionHandler(Exception.class)
  ResponseEntity<ApiError> x(Exception x) {
    return responses.response(
        HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "An unexpected error occurred");
  }
}
