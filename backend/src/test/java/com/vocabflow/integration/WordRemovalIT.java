package com.vocabflow.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.vocabflow.identity.infrastructure.UserEntity;
import com.vocabflow.vocabulary.application.VocabularyService;
import com.vocabflow.vocabulary.infrastructure.UserVocabularyEntity;
import com.vocabflow.vocabulary.infrastructure.VocabularyItemEntity;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class WordRemovalIT extends MysqlIntegrationTest {
  @Autowired private VocabularyService vocabularyService;

  @Test
  void removingAFailedWordTakesItOutOfEveryStoredPlanAndLeavesTheOtherItemsInOrder() {
    long user = users.saveAndFlush(user("remove-plans@example.com")).id;
    VocabularyItemEntity first = item("alpha", "COMPLETED");
    VocabularyItemEntity failed = item("typo", "FAILED");
    VocabularyItemEntity last = item("omega", "COMPLETED");
    UserVocabularyEntity firstEntry = entry(user, first);
    UserVocabularyEntity failedEntry = entry(user, failed);
    UserVocabularyEntity lastEntry = entry(user, last);
    long today = plan(user, "2026-12-01", firstEntry, failedEntry, lastEntry);
    long yesterday = plan(user, "2026-11-30", failedEntry);

    vocabularyService.remove(user, failedEntry.id);

    assertThat(userVocabularies.findById(failedEntry.id)).isEmpty();
    assertThat(vocabularyItems.findById(failed.id)).isEmpty();
    assertThat(planOrder(today))
        .containsExactly(List.of(firstEntry.id, 0).toArray(), List.of(lastEntry.id, 2).toArray());
    assertThat(planOrder(yesterday)).isEmpty();
    assertThat(userVocabularies.findById(firstEntry.id)).isPresent();
    assertThat(vocabularyItems.findById(first.id)).isPresent();
  }

  @Test
  void theSharedItemStaysUntilTheLastUserWhoHasItRemovesIt() {
    long one = users.saveAndFlush(user("remove-shared-one@example.com")).id;
    long two = users.saveAndFlush(user("remove-shared-two@example.com")).id;
    VocabularyItemEntity shared = item("shared typo", "FAILED");
    UserVocabularyEntity oneEntry = entry(one, shared);
    UserVocabularyEntity twoEntry = entry(two, shared);

    vocabularyService.remove(one, oneEntry.id);

    assertThat(userVocabularies.findById(oneEntry.id)).isEmpty();
    assertThat(userVocabularies.findById(twoEntry.id)).isPresent();
    assertThat(vocabularyItems.findById(shared.id)).isPresent();

    vocabularyService.remove(two, twoEntry.id);

    assertThat(vocabularyItems.findById(shared.id)).isEmpty();
  }

  private List<Object[]> planOrder(long planId) {
    return jdbcTemplate.query(
        "SELECT user_vocabulary_id, item_order FROM daily_learning_plan_items"
            + " WHERE daily_learning_plan_id = ? ORDER BY item_order",
        (rows, index) -> new Object[] {rows.getLong(1), rows.getInt(2)},
        planId);
  }

  private long plan(long userId, String date, UserVocabularyEntity... entries) {
    jdbcTemplate.update(
        "INSERT INTO daily_learning_plans (user_id, learning_date, new_vocabulary_goal, created_at)"
            + " VALUES (?, ?, 10, ?)",
        userId,
        date,
        java.sql.Timestamp.from(Instant.parse("2026-11-01T00:00:00Z")));
    long planId =
        jdbcTemplate.queryForObject(
            "SELECT id FROM daily_learning_plans WHERE user_id = ? AND learning_date = ?",
            Long.class,
            userId,
            date);
    int order = 0;
    for (UserVocabularyEntity entry : entries) {
      jdbcTemplate.update(
          "INSERT INTO daily_learning_plan_items (daily_learning_plan_id, user_vocabulary_id,"
              + " vocabulary_item_id, item_type, item_order, term) VALUES (?, ?, ?, 'NEW', ?, ?)",
          planId,
          entry.id,
          entry.item.id,
          order++,
          entry.item.term);
    }
    return planId;
  }

  private UserVocabularyEntity entry(long userId, VocabularyItemEntity item) {
    UserVocabularyEntity entry = new UserVocabularyEntity();
    entry.userId = userId;
    entry.item = item;
    entry.learningStatus = "NEW";
    entry.createdAt = Instant.parse("2026-11-01T00:00:00Z");
    return userVocabularies.saveAndFlush(entry);
  }

  private VocabularyItemEntity item(String term, String status) {
    VocabularyItemEntity item = new VocabularyItemEntity();
    item.term = term;
    item.normalizedTerm = term;
    item.enrichmentStatus = status;
    item.createdAt = Instant.parse("2026-11-01T00:00:00Z");
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
