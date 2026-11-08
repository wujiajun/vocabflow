package com.vocabflow.progress.application;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** What the learning module knows about the learner's progress; implemented there. */
public interface LearningProgress {
  /** Words with a learning card whose content is COMPLETED. */
  int startedWords(long userId);

  /** Of those, the words whose review interval is mature (21 days or more). */
  int masteredWords(long userId);

  /** Per study date in the range (both included): cards rated and of those first-time words. */
  List<DayCards> cardsByDay(long userId, LocalDate from, LocalDate to);

  /** Finished practice rounds per study date in the range (days without any are absent). */
  Map<LocalDate, Integer> roundsByDay(long userId, LocalDate from, LocalDate to);

  record DayCards(LocalDate date, int cards, int newWords) {}
}
