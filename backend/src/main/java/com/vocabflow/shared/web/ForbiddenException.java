package com.vocabflow.shared.web;

public class ForbiddenException extends ApiException {
  public ForbiddenException(String m) {
    super(m);
  }
}
