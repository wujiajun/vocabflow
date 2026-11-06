package com.vocabflow.article.infrastructure;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ArticleReadJpaRepository extends JpaRepository<ArticleReadEntity, Long> {
  List<ArticleReadEntity> findByUserId(Long userId);

  boolean existsByUserIdAndArticleId(Long userId, String articleId);

  void deleteByUserIdAndArticleId(Long userId, String articleId);
}
