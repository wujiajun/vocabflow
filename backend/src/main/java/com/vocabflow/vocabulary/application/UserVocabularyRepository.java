package com.vocabflow.vocabulary.application;

import com.vocabflow.vocabulary.domain.*;
import java.util.Optional;

public interface UserVocabularyRepository {
  boolean existsByUserIdAndVocabularyItemId(long userId, long vocabularyItemId);

  Optional<UserVocabulary> saveIfAbsent(UserVocabulary userVocabulary);

  VocabularyPage findByUserId(long userId, int page, int size);

  Optional<UserVocabulary> findByIdAndUserId(long id, long userId);
}
