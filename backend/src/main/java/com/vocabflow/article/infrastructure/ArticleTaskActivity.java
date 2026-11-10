package com.vocabflow.article.infrastructure;

import com.vocabflow.article.application.ArticleCatalog;
import com.vocabflow.article.application.ArticleReadRepository;
import com.vocabflow.tasks.application.ArticleActivity;
import java.time.Instant;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class ArticleTaskActivity implements ArticleActivity {
  private final ArticleReadJpaRepository reads;
  private final ArticleReadRepository readRepository;
  private final ArticleCatalog catalog;

  public ArticleTaskActivity(
      ArticleReadJpaRepository reads,
      ArticleReadRepository readRepository,
      ArticleCatalog catalog) {
    this.reads = reads;
    this.readRepository = readRepository;
    this.catalog = catalog;
  }

  @Override
  public int readBetween(long userId, Instant from, Instant to) {
    return reads.countByUserIdAndReadAtGreaterThanEqualAndReadAtLessThan(userId, from, to);
  }

  @Override
  public int readLongBetween(long userId, Instant from, Instant to, int minutes) {
    return (int)
        reads.findByUserIdAndReadAtGreaterThanEqualAndReadAtLessThan(userId, from, to).stream()
            .filter(
                r ->
                    catalog
                        .article(r.articleId)
                        .map(a -> a.readingMinutes() >= minutes)
                        .orElse(false))
            .count();
  }

  @Override
  public boolean unreadLongArticleFor(long userId, int clb, int minutes) {
    Map<String, Instant> read = readRepository.reads(userId);
    return catalog.albums().stream()
        .filter(album -> album.clbMin() <= clb && clb <= album.clbMax())
        .anyMatch(
            album ->
                album.articles().stream()
                    .anyMatch(a -> a.readingMinutes() >= minutes && !read.containsKey(a.id())));
  }

  @Override
  public boolean unreadArticleFor(long userId, int clb) {
    Map<String, Instant> read = readRepository.reads(userId);
    return catalog.albums().stream()
        .filter(album -> album.clbMin() <= clb && clb <= album.clbMax())
        .anyMatch(album -> album.articles().stream().anyMatch(a -> !read.containsKey(a.id())));
  }
}
