package com.vocabflow.push.domain;

/** The text of the daily reminder: short and friendly. */
public final class ReminderMessage {
  public static final String TITLE = "VocabFlow";
  public static final String URL = "/app/study";

  private ReminderMessage() {}

  public static String body(int streak) {
    if (streak >= 2) {
      return "Your " + streak + "-day streak is waiting. A few minutes is enough.";
    }
    return "Today's words are ready whenever you are.";
  }
}
