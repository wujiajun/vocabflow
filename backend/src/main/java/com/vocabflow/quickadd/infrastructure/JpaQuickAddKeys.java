package com.vocabflow.quickadd.infrastructure;

import com.vocabflow.quickadd.application.QuickAddKeys;
import java.time.Instant;
import java.util.Optional;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class JpaQuickAddKeys implements QuickAddKeys {
  private final QuickAddKeyJpaRepository rows;

  public JpaQuickAddKeys(QuickAddKeyJpaRepository rows) {
    this.rows = rows;
  }

  @Override
  @Transactional
  public void replace(long userId, String keyHash, Instant at) {
    QuickAddKeyEntity entity = rows.findByUserId(userId).orElseGet(QuickAddKeyEntity::new);
    entity.userId = userId;
    entity.keyHash = keyHash;
    entity.createdAt = at;
    entity.lastUsedAt = null;
    rows.saveAndFlush(entity);
  }

  @Override
  public Optional<Long> userIdFor(String keyHash) {
    return rows.findByKeyHash(keyHash).map(entity -> entity.userId);
  }

  @Override
  public void markUsed(String keyHash, Instant at) {
    rows.markUsed(keyHash, at);
  }

  @Override
  public boolean delete(long userId) {
    return rows.deleteByUser(userId) > 0;
  }

  @Override
  public Optional<Status> status(long userId) {
    return rows.findByUserId(userId).map(entity -> new Status(entity.createdAt, entity.lastUsedAt));
  }
}
