package com.vocabflow.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.vocabflow.identity.infrastructure.UserEntity;
import com.vocabflow.vocabulary.infrastructure.UserVocabularyEntity;
import com.vocabflow.vocabulary.infrastructure.VocabularyItemEntity;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;

class MysqlPersistenceIT extends MysqlIntegrationTest {
  @Test
  void persistsUserWithGeneratedIdTimestampAndPasswordHash() {
    UserEntity saved = users.saveAndFlush(user("learner@example.com"));

    UserEntity reloaded = users.findById(saved.id).orElseThrow();
    assertThat(reloaded.id).isNotNull();
    assertThat(reloaded.createdAt).isEqualTo(saved.createdAt);
    assertThat(reloaded.passwordHash).isEqualTo("bcrypt-hash-value");
  }

  @Test
  void enforcesUniqueUserEmailInMysql() {
    users.saveAndFlush(user("duplicate@example.com"));

    assertThatThrownBy(() -> users.saveAndFlush(user("duplicate@example.com")))
        .isInstanceOf(DataIntegrityViolationException.class);
  }

  @Test
  void persistsVocabularyRelationshipAndIsolatesUserQueries() {
    UserEntity firstUser = users.saveAndFlush(user("first@example.com"));
    UserEntity secondUser = users.saveAndFlush(user("second@example.com"));
    VocabularyItemEntity item = vocabularyItems.saveAndFlush(vocabularyItem("figure out"));
    UserVocabularyEntity relationship =
        userVocabularies.saveAndFlush(userVocabulary(firstUser.id, item));

    assertThat(userVocabularies.findByIdAndUserId(relationship.id, firstUser.id)).isPresent();
    assertThat(userVocabularies.findByIdAndUserId(relationship.id, secondUser.id)).isEmpty();
    assertThat(
            userVocabularies
                .findByUserIdOrderByCreatedAtDesc(firstUser.id, PageRequest.of(0, 20))
                .getContent())
        .singleElement()
        .satisfies(
            persisted -> {
              assertThat(persisted.id).isEqualTo(relationship.id);
              assertThat(persisted.userId).isEqualTo(firstUser.id);
              assertThat(persisted.item.id).isEqualTo(item.id);
              assertThat(persisted.learningStatus).isEqualTo("NEW");
            });
    assertThat(
            userVocabularies
                .findByUserIdOrderByCreatedAtDesc(secondUser.id, PageRequest.of(0, 20))
                .getContent())
        .isEmpty();
  }

  @Test
  void enforcesUniqueUserVocabularyAndForeignKeysInMysql() {
    UserEntity user = users.saveAndFlush(user("constraint@example.com"));
    VocabularyItemEntity item = vocabularyItems.saveAndFlush(vocabularyItem("overwhelmed"));
    userVocabularies.saveAndFlush(userVocabulary(user.id, item));

    assertThatThrownBy(() -> userVocabularies.saveAndFlush(userVocabulary(user.id, item)))
        .isInstanceOf(DataIntegrityViolationException.class);
    assertThatThrownBy(() -> userVocabularies.saveAndFlush(userVocabulary(999_999L, item)))
        .isInstanceOf(DataIntegrityViolationException.class);
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

  private VocabularyItemEntity vocabularyItem(String term) {
    VocabularyItemEntity item = new VocabularyItemEntity();
    item.term = term;
    item.normalizedTerm = term;
    item.enrichmentStatus = "COMPLETED";
    item.createdAt = Instant.parse("2026-01-01T00:00:00Z");
    return item;
  }

  private UserVocabularyEntity userVocabulary(long userId, VocabularyItemEntity item) {
    UserVocabularyEntity relationship = new UserVocabularyEntity();
    relationship.userId = userId;
    relationship.item = item;
    relationship.learningStatus = "NEW";
    relationship.createdAt = Instant.parse("2026-01-01T00:00:00Z");
    return relationship;
  }
}
