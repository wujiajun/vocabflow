package com.vocabflow.shared.web;

public class BadRequestException extends ApiException {
  public BadRequestException(String m) {
    super(m);
  }
}
