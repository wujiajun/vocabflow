package com.vocabflow.vocabulary.infrastructure;

import com.vocabflow.shared.infrastructure.JsonSupport;
import com.vocabflow.vocabulary.application.LearningVocabularyQuery;
import com.vocabflow.vocabulary.domain.*;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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

  @Override
  @Transactional(readOnly = true)
  public Map<Long, StudyContent> findStudyContent(long userId, Collection<Long> userVocabularyIds) {
    Map<Long, StudyContent> contents = new LinkedHashMap<>();
    if (userVocabularyIds.isEmpty()) {
      return contents;
    }
    for (UserVocabularyEntity entry :
        userVocabularies.findByUserIdAndIdIn(userId, userVocabularyIds)) {
      VocabularyItemEntity item = entry.item;
      contents.put(
          entry.id,
          new StudyContent(
              entry.id,
              item.id,
              item.term,
              item.type == null ? null : VocabularyType.valueOf(item.type),
              item.phonetic,
              item.partOfSpeech,
              item.definition,
              JsonSupport.read(item.examples),
              JsonSupport.read(item.collocations),
              EnrichmentStatus.valueOf(item.enrichmentStatus),
              VocabularySense.orSingle(
                  VocabularySenseJson.read(item.senses),
                  item.partOfSpeech,
                  item.phonetic,
                  item.definition,
                  JsonSupport.read(item.examples),
                  JsonSupport.read(item.collocations))));
    }
    return contents;
  }

  @Override
  @Transactional
  public void updateLearningStatus(long userId, long userVocabularyId, LearningStatus status) {
    UserVocabularyEntity entry =
        userVocabularies.findByIdAndUserId(userVocabularyId, userId).orElseThrow();
    entry.learningStatus = status.name();
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
