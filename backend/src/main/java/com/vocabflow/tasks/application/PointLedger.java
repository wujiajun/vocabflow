package com.vocabflow.tasks.application;

import java.time.LocalDate;
import java.util.List;

/** The points a user has earned. Entries are never changed or removed. */
public interface PointLedger {
  /**
   * Adds the entry unless the user already has one with the same date and key; true when added.
   * Catches a duplicate-key error, so it must not run inside a shared transaction.
   */
  boolean addIfAbsent(LedgerEntry entry);

  int balance(long userId);

  int earnedOn(long userId, LocalDate date);

  /** Newest first. */
  Page page(long userId, int page, int size);

  record Page(List<LedgerEntry> entries, int page, int size, long totalElements) {}
}
