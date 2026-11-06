package com.vocabflow.article.infrastructure;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(
    name = "article_reads",
    uniqueConstraints =
        @UniqueConstraint(
            name = "uk_article_reads_user_article",
            columnNames = {"user_id", "article_id"}))
public class ArticleReadEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @Column(name = "user_id", nullable = false)
  public Long userId;

  @Column(name = "article_id", nullable = false, length = 20)
  public String articleId;

  @Column(name = "read_at", nullable = false)
  public Instant readAt;
}
