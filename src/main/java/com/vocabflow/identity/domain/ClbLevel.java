package com.vocabflow.identity.domain;

public enum ClbLevel {
  CLB_1,
  CLB_2,
  CLB_3,
  CLB_4,
  CLB_5,
  CLB_6,
  CLB_7,
  CLB_8,
  CLB_9,
  CLB_10,
  CLB_11,
  CLB_12;

  public static ClbLevel from(String value) {
    try {
      return valueOf(value.trim().toUpperCase().replace("-", "_"));
    } catch (Exception e) {
      throw new IllegalArgumentException("CLB level must be CLB_1 through CLB_12");
    }
  }
}
