package com.vocabflow.vocabulary.application;

import com.vocabflow.vocabulary.domain.LearningStatus;
import com.vocabflow.vocabulary.domain.LearningVocabulary;
import com.vocabflow.vocabulary.domain.StudyContent;
import java.util.Collection;
import java.util.List;
import java.util.Map;

public interface LearningVocabularyQuery {
  List<LearningVocabulary> findNewVocabularyForUser(long userId, int limit);

  /** The user's own entries among {@code userVocabularyIds}, keyed by id; others are absent. */
  Map<Long, StudyContent> findStudyContent(long userId, Collection<Long> userVocabularyIds);

  void updateLearningStatus(long userId, long userVocabularyId, LearningStatus status);
}
