package com.vocabflow.shared.web;

public class TooManyRequestsException extends ApiException {
  public TooManyRequestsException(String m) {
    super(m);
  }
}
