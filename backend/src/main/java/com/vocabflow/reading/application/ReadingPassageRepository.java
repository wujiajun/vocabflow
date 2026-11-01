package com.vocabflow.reading.application;

import com.vocabflow.reading.domain.ReadingPage;
import com.vocabflow.reading.domain.ReadingPassage;
import java.time.LocalDate;
import java.util.Optional;

public interface ReadingPassageRepository {
  /** Empty when the user already has a passage for that day. */
  Optional<ReadingPassage> saveIfAbsent(ReadingPassage passage);

  Optional<ReadingPassage> findByUserIdAndStudyDate(long userId, LocalDate studyDate);

  Optional<ReadingPassage> findByIdAndUserId(long id, long userId);

  /** Newest first; {@code read} keeps only read or only unread passages when given. */
  ReadingPage list(long userId, Boolean read, int page, int size);

  ReadingPassage save(ReadingPassage passage);
}
