package com.vocabflow.scenario.infrastructure;

import com.vocabflow.scenario.application.ScenarioProgressRepository;
import java.sql.SQLIntegrityConstraintViolationException;
import java.time.Instant;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Repository;

@Repository
public class JpaScenarioProgressRepositoryAdapter implements ScenarioProgressRepository {
  private final ScenarioProgressJpaRepository rows;

  public JpaScenarioProgressRepositoryAdapter(ScenarioProgressJpaRepository rows) {
    this.rows = rows;
  }

  @Override
  public Map<String, Progress> progress(long userId) {
    return rows.findByUserId(userId).stream()
        .collect(
            Collectors.toUnmodifiableMap(
                entity -> entity.scenarioId,
                entity ->
                    new Progress(
                        entity.completedAt,
                        entity.bestScore,
                        entity.speakingScore,
                        entity.spokenAt)));
  }

  @Override
  public void complete(long userId, String scenarioId, Instant at, Integer score) {
    if (!rows.existsByUserIdAndScenarioId(userId, scenarioId)) {
      ScenarioProgressEntity entity = new ScenarioProgressEntity();
      entity.userId = userId;
      entity.scenarioId = scenarioId;
      entity.completedAt = at;
      entity.bestScore = score;
      try {
        rows.saveAndFlush(entity);
        return;
      } catch (DataIntegrityViolationException exception) {
        // Two requests finished the same scenario at once: it is finished, as asked.
        if (!isDuplicateKeyViolation(exception)) {
          throw exception;
        }
      }
    }
    if (score != null) {
      rows.raiseBestScore(userId, scenarioId, score);
    }
  }

  @Override
  public void recordSpeaking(long userId, String scenarioId, Instant at, int score) {
    if (!rows.existsByUserIdAndScenarioId(userId, scenarioId)) {
      ScenarioProgressEntity entity = new ScenarioProgressEntity();
      entity.userId = userId;
      entity.scenarioId = scenarioId;
      entity.completedAt = at;
      entity.speakingScore = score;
      entity.spokenAt = at;
      try {
        rows.saveAndFlush(entity);
        return;
      } catch (DataIntegrityViolationException exception) {
        // The row was made meanwhile (the reading was finished at the same moment): update it.
        if (!isDuplicateKeyViolation(exception)) {
          throw exception;
        }
      }
    }
    rows.setSpeaking(userId, scenarioId, score, at);
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
