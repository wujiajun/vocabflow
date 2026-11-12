package com.vocabflow.push.application;

import java.time.LocalDate;
import java.time.LocalTime;

/** A browser that asked for the daily reminder. {@code deviceZone} is null when unknown. */
public record PushSubscription(
    long id,
    long userId,
    String endpoint,
    String p256dh,
    String auth,
    LocalTime remindAt,
    String deviceZone,
    LocalDate lastSentDate) {}
