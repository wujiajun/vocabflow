package com.vocabflow.vocabulary.infrastructure;

import com.vocabflow.shared.infrastructure.JsonSupport;
import com.vocabflow.vocabulary.application.UserVocabularyRepository;
import com.vocabflow.vocabulary.domain.*;
import java.sql.SQLIntegrityConstraintViolationException;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Repository;

@Repository
public class JpaUserVocabularyRepositoryAdapter implements UserVocabularyRepository {
  private final UserVocabularyJpaRepository userVocabularies;
  private final VocabularyItemJpaRepository vocabularyItems;

  public JpaUserVocabularyRepositoryAdapter(
      UserVocabularyJpaRepository userVocabularies, VocabularyItemJpaRepository vocabularyItems) {
    this.userVocabularies = userVocabularies;
    this.vocabularyItems = vocabularyItems;
  }

  @Override
  public boolean existsByUserIdAndVocabularyItemId(long userId, long vocabularyItemId) {
    return userVocabularies.existsByUserIdAndItem_Id(userId, vocabularyItemId);
  }

  @Override
  public Optional<UserVocabulary> saveIfAbsent(UserVocabulary userVocabulary) {
    try {
      UserVocabularyEntity saved = userVocabularies.saveAndFlush(entity(userVocabulary));
      return Optional.of(
          new UserVocabulary(
              saved.id,
              userVocabulary.userId(),
              userVocabulary.item(),
              userVocabulary.learningStatus(),
              userVocabulary.createdAt(),
              userVocabulary.source()));
    } catch (DataIntegrityViolationException exception) {
      if (isDuplicateKeyViolation(exception)) {
        return Optional.empty();
      }
      throw exception;
    }
  }

  @Override
  public VocabularyPage findByUserId(long userId, int page, int size) {
    var result =
        userVocabularies.findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(page, size));
    return page(result);
  }

  @Override
  public VocabularyPage findFiltered(
      long userId, LearningStatus status, Collection<Long> ids, String search, int page, int size) {
    boolean anySearch = search == null || search.isBlank();
    return page(
        userVocabularies.findFiltered(
            userId,
            status == null ? null : status.name(),
            ids == null,
            ids == null ? List.of(0L) : ids,
            anySearch,
            anySearch ? "" : likePattern(search),
            PageRequest.of(page, size)));
  }

  /** Contains-match on the lower-cased text; {@code !}, {@code %} and {@code _} are literal. */
  static String likePattern(String search) {
    String stripped = search.strip();
    String text =
        stripped.substring(0, Math.min(stripped.length(), 100)).toLowerCase(java.util.Locale.ROOT);
    return "%" + text.replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
  }

  private VocabularyPage page(Page<UserVocabularyEntity> result) {
    return new VocabularyPage(
        result.getContent().stream().map(this::map).toList(),
        result.getNumber(),
        result.getSize(),
        result.getTotalElements(),
        result.getTotalPages());
  }

  @Override
  public boolean delete(long id, long userId) {
    try {
      return userVocabularies.deleteOwned(id, userId) == 1;
    } catch (DataIntegrityViolationException exception) {
      return false;
    }
  }

  @Override
  public boolean existsByVocabularyItemId(long vocabularyItemId) {
    return userVocabularies.existsByItem_Id(vocabularyItemId);
  }

  @Override
  public Optional<UserVocabulary> findByIdAndUserId(long id, long userId) {
    return userVocabularies.findByIdAndUserId(id, userId).map(this::map);
  }

  private UserVocabularyEntity entity(UserVocabulary userVocabulary) {
    UserVocabularyEntity entity = new UserVocabularyEntity();
    entity.userId = userVocabulary.userId();
    entity.item = vocabularyItems.getReferenceById(userVocabulary.item().id());
    entity.learningStatus = userVocabulary.learningStatus().name();
    entity.createdAt = userVocabulary.createdAt();
    SourceContext source = userVocabulary.source();
    if (source != null) {
      entity.sourceSentence = source.sentence();
      entity.sourceForm = source.form();
      entity.sourceTitle = source.title();
      entity.sourceLink = source.link();
    }
    return entity;
  }

  private UserVocabulary map(UserVocabularyEntity entity) {
    VocabularyItemEntity item = entity.item;
    return new UserVocabulary(
        entity.id,
        entity.userId,
        new VocabularyItem(
            item.id,
            new VocabularyTerm(item.term),
            item.type == null ? null : VocabularyType.valueOf(item.type),
            item.phonetic,
            item.partOfSpeech,
            item.definition,
            JsonSupport.read(item.examples),
            JsonSupport.read(item.collocations),
            EnrichmentStatus.valueOf(item.enrichmentStatus),
            item.failureReason,
            item.createdAt,
            VocabularySenseJson.read(item.senses),
            item.baseForm,
            item.spellingSuggestion),
        LearningStatus.valueOf(entity.learningStatus),
        entity.createdAt,
        entity.sourceSentence == null
            ? null
            : new SourceContext(
                entity.sourceSentence, entity.sourceForm, entity.sourceTitle, entity.sourceLink));
  }

  private boolean isDuplicateKeyViolation(DataIntegrityViolationException exception) {
    for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
      if (cause instanceof SQLIntegrityConstraintViolationException sqlException
          && (sqlException.getErrorCode() == 1062 || "23505".equals(sqlException.getSQLState()))) {
        return true;
      }
    }
    return false;
  }
}
