package com.vocabflow.tasks.application;

import java.time.Instant;
import java.time.LocalDate;

/** One line of the points ledger. {@code key} is the task key, {@code ALL_DONE} or a streak key. */
public record LedgerEntry(
    long userId, LocalDate date, String key, int amount, String reason, Instant createdAt) {}
