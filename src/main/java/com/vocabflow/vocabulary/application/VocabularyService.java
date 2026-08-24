package com.vocabflow.vocabulary.application;

import com.vocabflow.shared.infrastructure.JsonSupport;
import com.vocabflow.shared.web.*;
import com.vocabflow.vocabulary.domain.*;
import com.vocabflow.vocabulary.infrastructure.*;
import java.time.Instant;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class VocabularyService {
  final VocabularyItemJpaRepository items;
  final UserVocabularyJpaRepository userItems;
  final VocabularyEnrichmentProvider provider;

  public VocabularyService(
      VocabularyItemJpaRepository i,
      UserVocabularyJpaRepository u,
      VocabularyEnrichmentProvider p) {
    items = i;
    userItems = u;
    provider = p;
  }

  @Transactional
  public UserVocabularyEntity add(long uid, String raw) {
    VocabularyTerm term = new VocabularyTerm(raw);
    VocabularyItemEntity item =
        items.findByNormalizedTerm(term.normalized()).orElseGet(() -> create(term));
    if (userItems.existsByUserIdAndItem_Id(uid, item.id))
      throw new ConflictException("This vocabulary is already in your list");
    UserVocabularyEntity uv = new UserVocabularyEntity();
    uv.userId = uid;
    uv.item = item;
    uv.learningStatus = LearningStatus.NEW.name();
    uv.createdAt = Instant.now();
    return userItems.save(uv);
  }

  private VocabularyItemEntity create(VocabularyTerm term) {
    VocabularyItemEntity i = new VocabularyItemEntity();
    i.term = term.value();
    i.normalizedTerm = term.normalized();
    i.enrichmentStatus = EnrichmentStatus.PENDING.name();
    i.createdAt = Instant.now();
    i = items.save(i);
    try {
      i.enrichmentStatus = EnrichmentStatus.PROCESSING.name();
      i = items.save(i);
      EnrichmentResult r = provider.enrich(term);
      i.type = r.type().name();
      i.phonetic = r.phonetic();
      i.partOfSpeech = r.partOfSpeech();
      i.definition = r.definition();
      i.examples = JsonSupport.write(r.examples());
      i.collocations = JsonSupport.write(r.collocations());
      i.enrichmentStatus = EnrichmentStatus.COMPLETED.name();
    } catch (Exception e) {
      i.enrichmentStatus = EnrichmentStatus.FAILED.name();
      i.failureReason = "Enrichment could not be completed";
    }
    return items.save(i);
  }

  public Page<UserVocabularyEntity> list(long uid, int page, int size) {
    return userItems.findByUserIdOrderByCreatedAtDesc(
        uid, PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100)));
  }

  public UserVocabularyEntity detail(long uid, long id) {
    return userItems
        .findByIdAndUserId(id, uid)
        .orElseThrow(() -> new NotFoundException("Vocabulary was not found"));
  }
}
