package com.vocabflow.vocabulary.infrastructure;

import com.vocabflow.shared.infrastructure.JsonSupport;
import com.vocabflow.vocabulary.application.StudyRecords;
import com.vocabflow.vocabulary.application.VocabularyItemRepository;
import com.vocabflow.vocabulary.domain.*;
import java.sql.SQLIntegrityConstraintViolationException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class JpaVocabularyItemRepositoryAdapter implements VocabularyItemRepository {
  private final VocabularyItemJpaRepository items;
  private final UserVocabularyJpaRepository userVocabularies;
  private final StudyRecords studyRecords;

  public JpaVocabularyItemRepositoryAdapter(
      VocabularyItemJpaRepository items,
      UserVocabularyJpaRepository userVocabularies,
      StudyRecords studyRecords) {
    this.items = items;
    this.userVocabularies = userVocabularies;
    this.studyRecords = studyRecords;
  }

  @Override
  public Optional<VocabularyItem> findById(long id) {
    return items.findById(id).map(this::map);
  }

  @Override
  public Optional<VocabularyItem> findByNormalizedTerm(String normalizedTerm) {
    return items.findByNormalizedTerm(normalizedTerm).map(this::map);
  }

  @Override
  public Optional<VocabularyItem> saveIfAbsent(VocabularyItem item) {
    try {
      return Optional.of(map(items.saveAndFlush(entity(item))));
    } catch (DataIntegrityViolationException exception) {
      if (isDuplicateKeyViolation(exception)) {
        return Optional.empty();
      }
      throw exception;
    }
  }

  @Override
  public VocabularyItem save(VocabularyItem item) {
    return map(items.save(entity(item)));
  }

  @Override
  public boolean claimForEnrichment(
      long id, Set<EnrichmentStatus> claimable, Instant now, Instant staleBefore) {
    return items.claim(
            id, claimable.stream().map(Enum::name).collect(Collectors.toSet()), now, staleBefore)
        == 1;
  }

  @Override
  public void markCompleted(long id, EnrichmentResult result, String source, Instant at) {
    VocabularyItemEntity entity = items.findById(id).orElseThrow();
    fill(entity, result, source, at);
    entity.baseForm = result.baseForm();
    // Only the capitals can differ: the lookup key stays as it was.
    if (result.term() != null) {
      entity.term = result.term();
    }
    items.save(entity);
  }

  // Not read-only and not shared with a caller's transaction: a failure here (for example a
  // duplicate key when another thread just created the base word) rolls back everything, and the
  // caller then completes the item as typed.
  @Override
  @Transactional
  public boolean completeAsBaseForm(long id, EnrichmentResult result, String source, Instant at) {
    VocabularyTerm base = new VocabularyTerm(result.baseForm());
    VocabularyItemEntity entity = items.findById(id).orElseThrow();
    if (base.normalized().equals(entity.normalizedTerm)) {
      return false;
    }
    List<UserVocabularyEntity> holders = userVocabularies.findByItem_Id(id);
    for (UserVocabularyEntity holder : holders) {
      if (studyRecords.isInUse(holder.userId, holder.id)) {
        return false;
      }
    }
    Optional<VocabularyItemEntity> existing = items.findByNormalizedTerm(base.normalized());
    if (existing.isEmpty()) {
      fill(entity, result, source, at);
      entity.term = base.value();
      entity.normalizedTerm = base.normalized();
      entity.baseForm = null;
      items.saveAndFlush(entity);
      return true;
    }
    VocabularyItemEntity target = existing.get();
    if (!EnrichmentStatus.COMPLETED.name().equals(target.enrichmentStatus)) {
      return false;
    }
    for (UserVocabularyEntity holder : holders) {
      if (userVocabularies.existsByUserIdAndItem_Id(holder.userId, target.id)) {
        return false;
      }
    }
    for (UserVocabularyEntity holder : holders) {
      holder.item = target;
      userVocabularies.saveAndFlush(holder);
    }
    items.deleteIfUnused(id);
    return true;
  }

  private void fill(
      VocabularyItemEntity entity, EnrichmentResult result, String source, Instant at) {
    entity.type = result.type() == null ? null : result.type().name();
    entity.phonetic = result.phonetic();
    entity.partOfSpeech = result.partOfSpeech();
    entity.definition = result.definition();
    entity.examples = JsonSupport.write(result.examples());
    entity.collocations = JsonSupport.write(result.collocations());
    entity.senses = VocabularySenseJson.write(result.senses());
    entity.spellingSuggestion = null;
    entity.enrichmentStatus = EnrichmentStatus.COMPLETED.name();
    entity.failureReason = null;
    entity.enrichedAt = at;
    entity.enrichmentSource = source;
  }

  @Override
  public void deleteIfUnused(long id) {
    items.deleteIfUnused(id);
  }

  @Override
  public List<Long> findCompletedIdsWithoutSenses() {
    return items.findCompletedIdsWithoutSenses();
  }

  @Override
  public void markMisspelled(long id, String suggestion, String reason) {
    VocabularyItemEntity entity = items.findById(id).orElseThrow();
    entity.enrichmentStatus = EnrichmentStatus.FAILED.name();
    entity.failureReason = reason;
    entity.spellingSuggestion = suggestion;
    items.save(entity);
  }

  @Override
  public void markFailed(long id, String reason) {
    VocabularyItemEntity entity = items.findById(id).orElseThrow();
    entity.enrichmentStatus = EnrichmentStatus.FAILED.name();
    entity.failureReason = reason;
    items.save(entity);
  }

  private VocabularyItemEntity entity(VocabularyItem item) {
    VocabularyItemEntity entity =
        item.id() == 0 ? new VocabularyItemEntity() : items.findById(item.id()).orElseThrow();
    entity.term = item.term().value();
    entity.normalizedTerm = item.term().normalized();
    entity.type = item.type() == null ? null : item.type().name();
    entity.phonetic = item.phonetic();
    entity.partOfSpeech = item.partOfSpeech();
    entity.definition = item.definition();
    entity.examples = JsonSupport.write(item.examples());
    entity.collocations = JsonSupport.write(item.collocations());
    entity.enrichmentStatus = item.enrichmentStatus().name();
    entity.failureReason = item.failureReason();
    entity.createdAt = item.createdAt();
    return entity;
  }

  private VocabularyItem map(VocabularyItemEntity entity) {
    return new VocabularyItem(
        entity.id,
        new VocabularyTerm(entity.term),
        entity.type == null ? null : VocabularyType.valueOf(entity.type),
        entity.phonetic,
        entity.partOfSpeech,
        entity.definition,
        JsonSupport.read(entity.examples),
        JsonSupport.read(entity.collocations),
        EnrichmentStatus.valueOf(entity.enrichmentStatus),
        entity.failureReason,
        entity.createdAt,
        VocabularySenseJson.read(entity.senses),
        entity.baseForm,
        entity.spellingSuggestion);
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
