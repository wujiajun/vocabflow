package com.vocabflow.shared.web;

import java.time.Instant;

public record ApiError(String code, String message, Instant timestamp) {}
