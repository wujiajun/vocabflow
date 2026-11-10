package com.vocabflow.article.infrastructure;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ArticleReadJpaRepository extends JpaRepository<ArticleReadEntity, Long> {
  List<ArticleReadEntity> findByUserId(Long userId);

  int countByUserIdAndReadAtGreaterThanEqualAndReadAtLessThan(
      Long userId, java.time.Instant from, java.time.Instant to);

  List<ArticleReadEntity> findByUserIdAndReadAtGreaterThanEqualAndReadAtLessThan(
      Long userId, java.time.Instant from, java.time.Instant to);

  boolean existsByUserIdAndArticleId(Long userId, String articleId);

  void deleteByUserIdAndArticleId(Long userId, String articleId);
}
