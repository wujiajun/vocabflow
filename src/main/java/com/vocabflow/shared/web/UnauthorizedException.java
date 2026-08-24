package com.vocabflow.shared.web;

public class UnauthorizedException extends ApiException {
  public UnauthorizedException(String m) {
    super(m);
  }
}
