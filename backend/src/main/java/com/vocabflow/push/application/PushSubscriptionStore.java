package com.vocabflow.push.application;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/** The stored subscriptions; every read or write by a user is limited to that user's rows. */
public interface PushSubscriptionStore {
  /**
   * Adds the subscription, or updates the one with the same endpoint (which then belongs to this
   * user). {@code lastSentDate} is stored as given.
   */
  void save(
      long userId,
      String endpoint,
      String p256dh,
      String auth,
      LocalTime remindAt,
      String deviceZone,
      LocalDate lastSentDate);

  /** Removes the user's subscription with this endpoint; false when there is none. */
  boolean delete(long userId, String endpoint);

  List<PushSubscription> findByUser(long userId);

  /** Every subscription; used by the minute job, which is the only caller. */
  List<PushSubscription> findAll();

  /**
   * Takes today's turn: true for exactly one caller per subscription and date, so a reminder is
   * never sent twice.
   */
  boolean claim(long id, LocalDate date);

  void deleteById(long id);
}
