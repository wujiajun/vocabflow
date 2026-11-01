package com.vocabflow.vocabulary.infrastructure;

import com.vocabflow.shared.infrastructure.JsonSupport;
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

@Repository
public class JpaVocabularyItemRepositoryAdapter implements VocabularyItemRepository {
  private final VocabularyItemJpaRepository items;

  public JpaVocabularyItemRepositoryAdapter(VocabularyItemJpaRepository items) {
    this.items = items;
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
    entity.type = result.type() == null ? null : result.type().name();
    entity.phonetic = result.phonetic();
    entity.partOfSpeech = result.partOfSpeech();
    entity.definition = result.definition();
    entity.examples = JsonSupport.write(result.examples());
    entity.collocations = JsonSupport.write(result.collocations());
    entity.senses = VocabularySenseJson.write(result.senses());
    entity.baseForm = result.baseForm();
    entity.spellingSuggestion = null;
    // Only the capitals can differ: the lookup key stays as it was.
    if (result.term() != null) {
      entity.term = result.term();
    }
    entity.enrichmentStatus = EnrichmentStatus.COMPLETED.name();
    entity.failureReason = null;
    entity.enrichedAt = at;
    entity.enrichmentSource = source;
    items.save(entity);
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
