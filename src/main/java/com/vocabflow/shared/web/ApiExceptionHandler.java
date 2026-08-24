package com.vocabflow.shared.web;

import java.time.Instant;
import org.springframework.http.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

@RestControllerAdvice
public class ApiExceptionHandler {
  record Error(String code, String message, Instant timestamp) {}

  private Error e(String c, String m) {
    return new Error(c, m, Instant.now());
  }

  @ExceptionHandler(BadRequestException.class)
  ResponseEntity<Error> b(BadRequestException x) {
    return ResponseEntity.badRequest().body(e("VALIDATION_ERROR", x.getMessage()));
  }

  @ExceptionHandler(ConflictException.class)
  ResponseEntity<Error> c(ConflictException x) {
    return ResponseEntity.status(409).body(e("CONFLICT", x.getMessage()));
  }

  @ExceptionHandler(NotFoundException.class)
  ResponseEntity<Error> n(NotFoundException x) {
    return ResponseEntity.status(404).body(e("NOT_FOUND", x.getMessage()));
  }

  @ExceptionHandler({UnauthorizedException.class})
  ResponseEntity<Error> u(RuntimeException x) {
    return ResponseEntity.status(401).body(e("UNAUTHORIZED", x.getMessage()));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  ResponseEntity<Error> v(MethodArgumentNotValidException x) {
    return ResponseEntity.badRequest()
        .body(e("VALIDATION_ERROR", x.getBindingResult().getFieldError().getDefaultMessage()));
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<Error> x(Exception x) {
    return ResponseEntity.status(500).body(e("INTERNAL_ERROR", "An unexpected error occurred"));
  }
}
