package com.vocabflow.push.application;

/** Sends one Web Push message; implemented over the push services of the browsers. */
public interface WebPushSender {
  enum Result {
    SENT,
    /** The push service says the subscription no longer exists (404 or 410). */
    GONE,
    FAILED
  }

  /** False when the server has no VAPID keys; reminders are then off. */
  boolean enabled();

  String publicKey();

  Result send(PushSubscription subscription, String payload);
}
