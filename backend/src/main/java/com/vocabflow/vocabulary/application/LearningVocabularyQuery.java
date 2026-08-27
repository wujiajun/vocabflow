package com.vocabflow.vocabulary.application;

import com.vocabflow.vocabulary.domain.LearningVocabulary;
import java.util.List;

public interface LearningVocabularyQuery {
  List<LearningVocabulary> findNewVocabularyForUser(long userId, int limit);
}
