package com.vocabflow.vocabulary.application;

import com.vocabflow.vocabulary.domain.*;
import java.util.Collection;
import java.util.Optional;

public interface UserVocabularyRepository {
  boolean existsByUserIdAndVocabularyItemId(long userId, long vocabularyItemId);

  Optional<UserVocabulary> saveIfAbsent(UserVocabulary userVocabulary);

  VocabularyPage findByUserId(long userId, int page, int size);

  /** Entries with this status, if given, and among these ids, if given; newest first. */
  VocabularyPage findFiltered(
      long userId, LearningStatus status, Collection<Long> ids, int page, int size);

  Optional<UserVocabulary> findByIdAndUserId(long id, long userId);

  /** Returns false when something else still refers to the entry, such as a plan being extended. */
  boolean delete(long id, long userId);

  boolean existsByVocabularyItemId(long vocabularyItemId);
}
