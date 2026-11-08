package com.vocabflow.tasks.application;

import com.vocabflow.tasks.domain.DayActivity;
import java.time.LocalDate;
import java.util.List;

/** What the learning module knows about a day; implemented there. */
public interface LearningActivity {
  /** Words rated on the study date. */
  int ratedCards(long userId, LocalDate date);

  /** Review cards due on the date that are still waiting. */
  int dueReviews(long userId, LocalDate date);

  /** Words that could still be rated for the first time (up to {@code limit}). */
  int newWordsAvailable(long userId, int limit);

  boolean planFinished(long userId, LocalDate date);

  /** Words the practice games can use on the date. */
  int gameWords(long userId, LocalDate date);

  List<DayActivity.GameResult> rounds(long userId, LocalDate date);
}
