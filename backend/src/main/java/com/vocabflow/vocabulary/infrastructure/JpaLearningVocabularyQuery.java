package com.vocabflow.vocabulary.infrastructure;

import com.vocabflow.vocabulary.application.LearningVocabularyQuery;
import com.vocabflow.vocabulary.domain.*;
import java.util.List;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class JpaLearningVocabularyQuery implements LearningVocabularyQuery {
  private final UserVocabularyJpaRepository userVocabularies;

  public JpaLearningVocabularyQuery(UserVocabularyJpaRepository userVocabularies) {
    this.userVocabularies = userVocabularies;
  }

  @Override
  @Transactional(readOnly = true)
  public List<LearningVocabulary> findNewVocabularyForUser(long userId, int limit) {
    return userVocabularies
        .findByUserIdAndLearningStatusOrderByCreatedAtAscIdAsc(
            userId, LearningStatus.NEW.name(), PageRequest.of(0, limit))
        .stream()
        .map(this::map)
        .toList();
  }

  private LearningVocabulary map(UserVocabularyEntity userVocabulary) {
    VocabularyItemEntity item = userVocabulary.item;
    return new LearningVocabulary(
        userVocabulary.id,
        item.id,
        item.term,
        item.type == null ? null : VocabularyType.valueOf(item.type),
        userVocabulary.createdAt);
  }
}
