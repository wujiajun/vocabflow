package com.vocabflow.reading.application;

import com.vocabflow.reading.domain.StudiedWord;
import java.time.LocalDate;
import java.util.List;

/** Implemented by the learning module, which knows what was studied and when. */
public interface StudiedWords {
  /** Whether that day's study has ended, so nothing is left to do on it for now. */
  boolean isFinished(long userId, LocalDate date);

  /** The words rated on the day, in the order they were first rated. */
  List<StudiedWord> studiedOn(long userId, LocalDate date);
}
