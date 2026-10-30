package com.vocabflow.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.vocabflow.identity.infrastructure.UserEntity;
import com.vocabflow.shared.web.ConflictException;
import com.vocabflow.vocabulary.application.VocabularyService;
import com.vocabflow.vocabulary.infrastructure.VocabularyItemEntity;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class VocabularyEnrichmentRepairIT extends MysqlIntegrationTest {
  @Autowired private VocabularyService vocabularyService;

  @Test
  void addingAStalePendingTermCompletesItsEnrichmentInTheSharedItem() {
    long user = users.saveAndFlush(user("repair@example.com")).id;
    VocabularyItemEntity stale = pendingItem("stranded term", Duration.ofHours(1));

    var added = vocabularyService.add(user, "stranded term");

    VocabularyItemEntity reloaded = vocabularyItems.findById(stale.id).orElseThrow();
    assertThat(reloaded.enrichmentStatus).isEqualTo("COMPLETED");
    assertThat(reloaded.definition).isNotBlank();
    assertThat(added.item().id()).isEqualTo(stale.id);
    assertThat(vocabularyItems.count()).isEqualTo(1);
  }

  @Test
  void repeatedAddByTheSameUserStillRepairsTheItemAndReportsConflict() {
    long user = users.saveAndFlush(user("repair-conflict@example.com")).id;
    VocabularyItemEntity stale = pendingItem("stranded again", Duration.ofHours(1));
    vocabularyService.add(user, "stranded again");
    stale.enrichmentStatus = "PENDING";
    stale.definition = null;
    vocabularyItems.saveAndFlush(stale);

    assertThatThrownBy(() -> vocabularyService.add(user, "stranded again"))
        .isInstanceOf(ConflictException.class);

    assertThat(vocabularyItems.findById(stale.id).orElseThrow().enrichmentStatus)
        .isEqualTo("COMPLETED");
  }

  @Test
  void addingARecentPendingTermDoesNotEnrichIt() {
    long user = users.saveAndFlush(user("repair-recent@example.com")).id;
    VocabularyItemEntity recent = pendingItem("being enriched", Duration.ofSeconds(10));

    vocabularyService.add(user, "being enriched");

    assertThat(vocabularyItems.findById(recent.id).orElseThrow().enrichmentStatus)
        .isEqualTo("PENDING");
  }

  private VocabularyItemEntity pendingItem(String term, Duration age) {
    VocabularyItemEntity item = new VocabularyItemEntity();
    item.term = term;
    item.normalizedTerm = term;
    item.enrichmentStatus = "PENDING";
    item.createdAt = Instant.now().minus(age);
    return vocabularyItems.saveAndFlush(item);
  }

  private UserEntity user(String email) {
    UserEntity user = new UserEntity();
    user.email = email;
    user.passwordHash = "bcrypt-hash-value";
    user.clbLevel = "CLB_5";
    user.dailyGoal = 10;
    user.createdAt = Instant.parse("2026-01-01T00:00:00Z");
    return user;
  }
}
