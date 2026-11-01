package com.vocabflow.reading.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * A passage written from the words a user studied on {@code studyDate}. {@code body} marks each use
 * of a target word as {@code [[word]]}; {@code words} lists the target words.
 */
public record ReadingPassage(
    long id,
    long userId,
    LocalDate studyDate,
    String title,
    String body,
    List<String> words,
    Instant readAt,
    Instant createdAt,
    String source) {
  public ReadingPassage {
    words = List.copyOf(words);
  }

  public boolean read() {
    return readAt != null;
  }

  public ReadingPassage withReadAt(Instant readAt) {
    return new ReadingPassage(id, userId, studyDate, title, body, words, readAt, createdAt, source);
  }
}
