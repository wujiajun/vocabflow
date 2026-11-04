package com.vocabflow.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.vocabflow.identity.application.UserRepository;
import com.vocabflow.identity.domain.*;
import com.vocabflow.identity.infrastructure.UserEntity;
import com.vocabflow.learning.domain.*;
import com.vocabflow.vocabulary.application.VocabularyItemRepository;
import com.vocabflow.vocabulary.domain.*;
import com.vocabflow.vocabulary.infrastructure.UserVocabularyEntity;
import com.vocabflow.vocabulary.infrastructure.VocabularyItemEntity;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;

class MysqlPersistenceIT extends MysqlIntegrationTest {
  @Autowired private UserRepository userRepository;
  @Autowired private VocabularyItemRepository itemPort;

  @Test
  void persistsUserThroughApplicationRepositoryPort() {
    User saved =
        userRepository.save(
            new User(
                0,
                new Email("port@example.com"),
                "bcrypt-hash-value",
                ClbLevel.CLB_5,
                new DailyVocabularyGoal(10),
                Instant.parse("2026-01-01T00:00:00Z")));

    assertThat(userRepository.findById(saved.id())).contains(saved);
  }

  @Test
  void persistsUserWithGeneratedIdTimestampAndPasswordHash() {
    UserEntity user = user("learner@example.com");
    user.createdAt = Instant.parse("2026-01-01T00:00:00.123456Z");
    UserEntity saved = users.saveAndFlush(user);

    UserEntity reloaded = users.findById(saved.id).orElseThrow();
    assertThat(reloaded.id).isNotNull();
    assertThat(reloaded.createdAt).isEqualTo(saved.createdAt);
    assertThat(reloaded.createdAt).isEqualTo(Instant.parse("2026-01-01T00:00:00.123456Z"));
    assertThat(reloaded.passwordHash).isEqualTo("bcrypt-hash-value");
  }

  @Test
  void usesUtcDatetimeWithMicrosecondPrecisionForAbsoluteTimestamps() {
    assertDatetimePrecision("users", "created_at");
    assertDatetimePrecision("vocabulary_items", "created_at");
    assertDatetimePrecision("user_vocabularies", "created_at");
    assertDatetimePrecision("revoked_tokens", "expires_at");
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

  @Test
  void persistenceAdaptersMapVocabularyAndPreserveUserIsolation() {
    UserEntity firstUser = users.saveAndFlush(user("adapter-first@example.com"));
    UserEntity secondUser = users.saveAndFlush(user("adapter-second@example.com"));
    VocabularyItem item =
        vocabularyItemRepository
            .saveIfAbsent(
                new VocabularyItem(
                    0,
                    new VocabularyTerm("figure out"),
                    VocabularyType.PHRASAL_VERB,
                    "/figure-out/",
                    "phrasal verb",
                    "To understand or solve something.",
                    java.util.List.of("I need to figure this out."),
                    java.util.List.of("figure out how"),
                    EnrichmentStatus.COMPLETED,
                    null,
                    Instant.parse("2026-01-01T00:00:00Z")))
            .orElseThrow();

    UserVocabulary saved =
        userVocabularyRepository
            .saveIfAbsent(
                new UserVocabulary(
                    0,
                    firstUser.id,
                    item,
                    LearningStatus.NEW,
                    Instant.parse("2026-01-01T00:00:00Z")))
            .orElseThrow();

    assertThat(
            userVocabularyRepository.saveIfAbsent(
                new UserVocabulary(
                    0,
                    firstUser.id,
                    item,
                    LearningStatus.NEW,
                    Instant.parse("2026-01-01T00:00:00Z"))))
        .isEmpty();
    assertThat(userVocabularyRepository.findByIdAndUserId(saved.id(), firstUser.id))
        .contains(saved);
    assertThat(userVocabularyRepository.findByIdAndUserId(saved.id(), secondUser.id)).isEmpty();
    assertThat(userVocabularyRepository.findByUserId(firstUser.id, 0, 20).content())
        .singleElement()
        .isEqualTo(saved);
  }

  @Test
  void learningPersistenceUsesOldestNewVocabularyAndStablePlans() {
    UserEntity user = users.saveAndFlush(user("learning@example.com"));
    UserEntity otherUser = users.saveAndFlush(user("other-learning@example.com"));
    VocabularyItemEntity newestItem = vocabularyItems.saveAndFlush(vocabularyItem("newest"));
    VocabularyItemEntity oldestItem = vocabularyItems.saveAndFlush(vocabularyItem("oldest"));
    VocabularyItemEntity otherItem = vocabularyItems.saveAndFlush(vocabularyItem("other"));
    UserVocabularyEntity newest = userVocabulary(user.id, newestItem);
    newest.createdAt = Instant.parse("2026-01-03T00:00:00Z");
    UserVocabularyEntity oldest = userVocabulary(user.id, oldestItem);
    oldest.createdAt = Instant.parse("2026-01-01T00:00:00Z");
    UserVocabularyEntity other = userVocabulary(otherUser.id, otherItem);
    other.createdAt = Instant.parse("2026-01-01T00:00:00Z");
    userVocabularies.saveAndFlush(newest);
    userVocabularies.saveAndFlush(oldest);
    userVocabularies.saveAndFlush(other);
    // Words whose content is not ready are older than the rest but must never be offered.
    for (String status : List.of("PENDING", "PROCESSING", "FAILED")) {
      VocabularyItemEntity unready = vocabularyItem("unready " + status.toLowerCase());
      unready.enrichmentStatus = status;
      UserVocabularyEntity entry = userVocabulary(user.id, vocabularyItems.saveAndFlush(unready));
      entry.createdAt = Instant.parse("2025-12-01T00:00:00Z");
      userVocabularies.saveAndFlush(entry);
    }

    List<LearningVocabulary> candidates = learningVocabulary.findNewVocabularyForUser(user.id, 2);
    assertThat(candidates)
        .extracting(LearningVocabulary::userVocabularyId)
        .containsExactly(oldest.id, newest.id);

    DailyLearningPlan plan =
        new DailyLearningPlan(
            0,
            user.id,
            java.time.LocalDate.of(2026, 8, 25),
            2,
            Instant.parse("2026-08-25T00:00:00.123456Z"),
            candidates.stream()
                .map(
                    candidate ->
                        new DailyLearningPlanItem(
                            candidate.userVocabularyId(),
                            candidate.vocabularyItemId(),
                            candidate.term(),
                            candidate.type(),
                            PlanItemType.NEW))
                .toList(),
            List.of());
    DailyLearningPlan saved = dailyLearningPlans.saveIfAbsent(plan).orElseThrow();

    assertThat(dailyLearningPlans.saveIfAbsent(plan)).isEmpty();
    assertThat(dailyLearningPlans.findByUserIdAndLearningDate(user.id, plan.learningDate()))
        .contains(saved);
    assertThat(saved.newItems())
        .extracting(DailyLearningPlanItem::userVocabularyId)
        .containsExactly(oldest.id, newest.id);
  }

  @Test
  void rollsBackPlanAndItemsWhenPlanItemCannotBePersisted() {
    UserEntity user = users.saveAndFlush(user("plan-rollback@example.com"));
    DailyLearningPlan invalidPlan =
        new DailyLearningPlan(
            0,
            user.id,
            java.time.LocalDate.of(2026, 8, 26),
            2,
            Instant.parse("2026-08-26T00:00:00Z"),
            List.of(
                new DailyLearningPlanItem(
                    999_999L, 999_999L, "missing", VocabularyType.WORD, PlanItemType.NEW)),
            List.of());

    assertThatThrownBy(() -> dailyLearningPlans.saveIfAbsent(invalidPlan))
        .isInstanceOf(DataIntegrityViolationException.class);

    assertThat(
            jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM daily_learning_plans WHERE user_id = ?",
                Integer.class,
                user.id))
        .isZero();
    assertThat(
            jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM daily_learning_plan_items", Integer.class))
        .isZero();
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

  @Test
  void anInflectedItemBecomesItsBaseWordOnMysql() {
    UserEntity first = users.saveAndFlush(user("base-first@example.com"));
    UserEntity second = users.saveAndFlush(user("base-second@example.com"));
    VocabularyItemEntity base = vocabularyItems.saveAndFlush(vocabularyItem("wallet"));
    VocabularyItemEntity inflected = vocabularyItems.saveAndFlush(vocabularyItem("wallets"));
    VocabularyItemEntity renamed = vocabularyItems.saveAndFlush(vocabularyItem("coats"));
    userVocabularies.saveAndFlush(userVocabulary(first.id, base));
    UserVocabularyEntity moving =
        userVocabularies.saveAndFlush(userVocabulary(second.id, inflected));
    UserVocabularyEntity staying =
        userVocabularies.saveAndFlush(userVocabulary(second.id, renamed));
    EnrichmentResult wallet = result().withBaseForm("wallet");
    EnrichmentResult coat = result().withBaseForm("Coat");

    assertThat(itemPort.completeAsBaseForm(inflected.id, wallet, "fake", Instant.now())).isTrue();
    assertThat(itemPort.completeAsBaseForm(renamed.id, coat, "fake", Instant.now())).isTrue();

    // The entry moved to the existing item, and the leftover item is gone.
    assertThat(userVocabularies.findById(moving.id).orElseThrow().item.id).isEqualTo(base.id);
    assertThat(vocabularyItems.findById(inflected.id)).isEmpty();
    // With no item of that word, the item itself became the word.
    VocabularyItemEntity coatItem = vocabularyItems.findById(renamed.id).orElseThrow();
    assertThat(coatItem.term).isEqualTo("Coat");
    assertThat(coatItem.normalizedTerm).isEqualTo("coat");
    assertThat(coatItem.baseForm).isNull();
    assertThat(userVocabularies.findById(staying.id).orElseThrow().item.id).isEqualTo(renamed.id);
  }

  private EnrichmentResult result() {
    return new EnrichmentResult(
        VocabularyType.WORD,
        null,
        "noun",
        "A definition.",
        List.of("An example."),
        List.of("a collocation"));
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

  private void assertDatetimePrecision(String table, String column) {
    assertThat(
            jdbcTemplate.queryForObject(
                """
                SELECT DATA_TYPE
                FROM information_schema.columns
                WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?
                """,
                String.class,
                table,
                column))
        .isEqualTo("datetime");
    assertThat(
            jdbcTemplate.queryForObject(
                """
                SELECT DATETIME_PRECISION
                FROM information_schema.columns
                WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?
                """,
                Integer.class,
                table,
                column))
        .isEqualTo(6);
  }
}
