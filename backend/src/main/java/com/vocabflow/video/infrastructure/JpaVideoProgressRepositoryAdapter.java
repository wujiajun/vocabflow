package com.vocabflow.video.infrastructure;

import com.vocabflow.video.application.VideoProgressRepository;
import java.sql.SQLIntegrityConstraintViolationException;
import java.time.Instant;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class JpaVideoProgressRepositoryAdapter implements VideoProgressRepository {
  private final VideoProgressJpaRepository progress;
  private final VideoPositionJpaRepository positions;

  public JpaVideoProgressRepositoryAdapter(
      VideoProgressJpaRepository progress, VideoPositionJpaRepository positions) {
    this.progress = progress;
    this.positions = positions;
  }

  @Override
  public Set<String> watchedVideoIds(long userId) {
    return progress.findByUserId(userId).stream()
        .map(entity -> entity.videoId)
        .collect(Collectors.toUnmodifiableSet());
  }

  @Override
  public void markWatched(long userId, String videoId, Instant at) {
    if (progress.existsByUserIdAndVideoId(userId, videoId)) {
      return;
    }
    VideoProgressEntity entity = new VideoProgressEntity();
    entity.userId = userId;
    entity.videoId = videoId;
    entity.watchedAt = at;
    try {
      progress.saveAndFlush(entity);
    } catch (DataIntegrityViolationException exception) {
      // Two requests marked the same video at once: it is marked, which is what was asked.
      if (!isDuplicateKeyViolation(exception)) {
        throw exception;
      }
    }
  }

  @Override
  @Transactional
  public void unmarkWatched(long userId, String videoId) {
    progress.deleteByUserIdAndVideoId(userId, videoId);
  }

  @Override
  public Map<String, Integer> positions(long userId) {
    return positions.findByUserId(userId).stream()
        .collect(
            Collectors.toUnmodifiableMap(
                entity -> entity.videoId, entity -> entity.positionSeconds));
  }

  @Override
  public void savePosition(long userId, String videoId, int seconds, Instant at) {
    if (positions.update(userId, videoId, seconds, at) > 0) {
      return;
    }
    VideoPositionEntity entity = new VideoPositionEntity();
    entity.userId = userId;
    entity.videoId = videoId;
    entity.positionSeconds = seconds;
    entity.updatedAt = at;
    try {
      positions.saveAndFlush(entity);
    } catch (DataIntegrityViolationException exception) {
      // Another save made the row a moment ago: this one is the newer place, so it replaces it.
      if (!isDuplicateKeyViolation(exception)) {
        throw exception;
      }
      positions.update(userId, videoId, seconds, at);
    }
  }

  @Override
  public void clearPosition(long userId, String videoId) {
    positions.deleteByUserIdAndVideoId(userId, videoId);
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
