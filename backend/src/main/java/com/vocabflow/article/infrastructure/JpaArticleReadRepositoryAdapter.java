package com.vocabflow.article.infrastructure;

import com.vocabflow.article.application.ArticleReadRepository;
import java.sql.SQLIntegrityConstraintViolationException;
import java.time.Instant;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class JpaArticleReadRepositoryAdapter implements ArticleReadRepository {
  private final ArticleReadJpaRepository reads;

  public JpaArticleReadRepositoryAdapter(ArticleReadJpaRepository reads) {
    this.reads = reads;
  }

  @Override
  public Map<String, Instant> reads(long userId) {
    return reads.findByUserId(userId).stream()
        .collect(Collectors.toUnmodifiableMap(entity -> entity.articleId, entity -> entity.readAt));
  }

  @Override
  public void markRead(long userId, String articleId, Instant at) {
    if (reads.existsByUserIdAndArticleId(userId, articleId)) {
      return;
    }
    ArticleReadEntity entity = new ArticleReadEntity();
    entity.userId = userId;
    entity.articleId = articleId;
    entity.readAt = at;
    try {
      reads.saveAndFlush(entity);
    } catch (DataIntegrityViolationException exception) {
      // Two requests marked the same article at once: it is marked, which is what was asked.
      if (!isDuplicateKeyViolation(exception)) {
        throw exception;
      }
    }
  }

  @Override
  @Transactional
  public void unmarkRead(long userId, String articleId) {
    reads.deleteByUserIdAndArticleId(userId, articleId);
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
