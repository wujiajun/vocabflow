package com.vocabflow.learning.infrastructure;

import com.vocabflow.learning.application.GameWordPlays;
import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Repository;

@Repository
public class JpaGameWordPlays implements GameWordPlays {
  private final GameWordPlayJpaRepository plays;

  public JpaGameWordPlays(GameWordPlayJpaRepository plays) {
    this.plays = plays;
  }

  @Override
  public Map<Long, Instant> lastPlayed(long userId, Collection<Long> ids) {
    Map<Long, Instant> result = new HashMap<>();
    if (!ids.isEmpty()) {
      plays
          .findByUserIdAndUserVocabularyIdIn(userId, ids)
          .forEach(play -> result.put(play.userVocabularyId, play.lastPlayedAt));
    }
    return result;
  }

  @Override
  public void record(long userId, Collection<Long> ids, Instant now) {
    for (long id : ids) {
      if (plays.touch(userId, id, now) > 0) {
        continue;
      }
      GameWordPlayEntity entity = new GameWordPlayEntity();
      entity.userId = userId;
      entity.userVocabularyId = id;
      entity.lastPlayedAt = now;
      entity.playCount = 1;
      try {
        plays.saveAndFlush(entity);
      } catch (DataIntegrityViolationException raced) {
        // Another request started this word's row first (the unique key): count this play on it.
        if (plays.touch(userId, id, now) == 0) {
          throw raced;
        }
      }
    }
  }
}
