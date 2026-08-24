package com.vocabflow.shared.web;

public class ApiException extends RuntimeException {
  public ApiException(String m) {
    super(m);
  }
}
