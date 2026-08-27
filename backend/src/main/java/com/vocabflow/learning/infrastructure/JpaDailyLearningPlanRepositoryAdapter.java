package com.vocabflow.learning.infrastructure;

import com.vocabflow.learning.application.DailyLearningPlanRepository;
import com.vocabflow.learning.domain.*;
import java.sql.SQLIntegrityConstraintViolationException;
import java.time.LocalDate;
import java.util.Optional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class JpaDailyLearningPlanRepositoryAdapter implements DailyLearningPlanRepository {
  private final DailyLearningPlanJpaRepository plans;
  private final DailyLearningPlanInsertTransaction insertTransaction;

  public JpaDailyLearningPlanRepositoryAdapter(
      DailyLearningPlanJpaRepository plans, DailyLearningPlanInsertTransaction insertTransaction) {
    this.plans = plans;
    this.insertTransaction = insertTransaction;
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<DailyLearningPlan> findByUserIdAndLearningDate(
      long userId, LocalDate learningDate) {
    return plans.findByUserIdAndLearningDate(userId, learningDate).map(this::map);
  }

  @Override
  public Optional<DailyLearningPlan> saveIfAbsent(DailyLearningPlan plan) {
    try {
      return Optional.of(map(insertTransaction.insert(entity(plan))));
    } catch (DataIntegrityViolationException exception) {
      if (isDuplicateKeyViolation(exception)) {
        return Optional.empty();
      }
      throw exception;
    }
  }

  private DailyLearningPlanEntity entity(DailyLearningPlan plan) {
    DailyLearningPlanEntity entity = new DailyLearningPlanEntity();
    entity.userId = plan.userId();
    entity.learningDate = plan.learningDate();
    entity.newVocabularyGoal = plan.newVocabularyGoal();
    entity.createdAt = plan.createdAt();
    int itemOrder = 0;
    for (DailyLearningPlanItem item : plan.newItems()) {
      entity.items.add(itemEntity(entity, item, itemOrder++));
    }
    for (DailyLearningPlanItem item : plan.reviewItems()) {
      entity.items.add(itemEntity(entity, item, itemOrder++));
    }
    return entity;
  }

  private DailyLearningPlanItemEntity itemEntity(
      DailyLearningPlanEntity plan, DailyLearningPlanItem item, int itemOrder) {
    DailyLearningPlanItemEntity entity = new DailyLearningPlanItemEntity();
    entity.plan = plan;
    entity.userVocabularyId = item.userVocabularyId();
    entity.vocabularyItemId = item.vocabularyItemId();
    entity.itemType = item.itemType().name();
    entity.itemOrder = itemOrder;
    entity.term = item.term();
    entity.type = item.type() == null ? null : item.type().name();
    return entity;
  }

  private DailyLearningPlan map(DailyLearningPlanEntity entity) {
    return new DailyLearningPlan(
        entity.id,
        entity.userId,
        entity.learningDate,
        entity.newVocabularyGoal,
        entity.createdAt,
        entity.items.stream()
            .filter(item -> item.itemType.equals(PlanItemType.NEW.name()))
            .sorted(java.util.Comparator.comparingInt(item -> item.itemOrder))
            .map(this::mapItem)
            .toList(),
        entity.items.stream()
            .filter(item -> item.itemType.equals(PlanItemType.REVIEW.name()))
            .sorted(java.util.Comparator.comparingInt(item -> item.itemOrder))
            .map(this::mapItem)
            .toList());
  }

  private DailyLearningPlanItem mapItem(DailyLearningPlanItemEntity entity) {
    return new DailyLearningPlanItem(
        entity.userVocabularyId,
        entity.vocabularyItemId,
        entity.term,
        entity.type == null
            ? null
            : com.vocabflow.vocabulary.domain.VocabularyType.valueOf(entity.type),
        PlanItemType.valueOf(entity.itemType));
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
