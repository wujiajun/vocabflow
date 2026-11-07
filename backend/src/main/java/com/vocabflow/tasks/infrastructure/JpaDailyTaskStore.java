package com.vocabflow.tasks.infrastructure;

import com.vocabflow.tasks.application.DailyTaskStore;
import com.vocabflow.tasks.domain.DailyTask;
import com.vocabflow.tasks.domain.TaskCategory;
import com.vocabflow.tasks.domain.TaskType;
import java.sql.SQLIntegrityConstraintViolationException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Repository;

@Repository
public class JpaDailyTaskStore implements DailyTaskStore {
  private final DailyTaskJpaRepository tasks;
  private final DailyTaskInsertTransaction insertTransaction;

  public JpaDailyTaskStore(
      DailyTaskJpaRepository tasks, DailyTaskInsertTransaction insertTransaction) {
    this.tasks = tasks;
    this.insertTransaction = insertTransaction;
  }

  @Override
  public List<DailyTask> find(long userId, LocalDate date) {
    return tasks.findByUserIdAndStudyDateOrderByPosition(userId, date).stream()
        .map(
            e ->
                new DailyTask(
                    TaskType.valueOf(e.taskType), e.param, e.target, e.points, e.completedAt))
        .toList();
  }

  @Override
  public boolean saveIfAbsent(long userId, LocalDate date, List<DailyTask> list) {
    List<DailyTaskEntity> entities = new ArrayList<>();
    for (int i = 0; i < list.size(); i++) {
      DailyTask task = list.get(i);
      DailyTaskEntity e = new DailyTaskEntity();
      e.userId = userId;
      e.studyDate = date;
      e.position = i;
      e.taskKey = task.key();
      e.taskType = task.type().name();
      e.category = task.type().category().name();
      e.param = task.param();
      e.target = task.target();
      e.points = task.points();
      e.completedAt = task.completedAt();
      entities.add(e);
    }
    DailyTaskDayEntity day = new DailyTaskDayEntity();
    day.userId = userId;
    day.studyDate = date;
    day.createdAt = Instant.now();
    try {
      insertTransaction.insert(day, entities);
      return true;
    } catch (DataIntegrityViolationException exception) {
      if (isDuplicateKeyViolation(exception)) {
        return false;
      }
      throw exception;
    }
  }

  @Override
  public void markCompleted(long userId, LocalDate date, String key, Instant at) {
    tasks.complete(userId, date, key, at);
  }

  @Override
  public Map<TaskCategory, LocalDate> lastCompleted(long userId, LocalDate before) {
    Map<TaskCategory, LocalDate> map = new EnumMap<>(TaskCategory.class);
    for (Object[] row : tasks.lastCompleted(userId, before)) {
      map.put(TaskCategory.valueOf((String) row[0]), (LocalDate) row[1]);
    }
    return map;
  }

  @Override
  public Set<LocalDate> baseCompletedDays(long userId) {
    return new HashSet<>(tasks.baseCompletedDays(userId));
  }

  static boolean isDuplicateKeyViolation(DataIntegrityViolationException exception) {
    for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
      if (cause instanceof SQLIntegrityConstraintViolationException sqlException
          && (sqlException.getErrorCode() == 1062 || "23505".equals(sqlException.getSQLState()))) {
        return true;
      }
    }
    return false;
  }
}
