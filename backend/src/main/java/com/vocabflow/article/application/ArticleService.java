package com.vocabflow.article.application;

import com.vocabflow.article.domain.Article;
import com.vocabflow.article.domain.ArticleAlbum;
import com.vocabflow.shared.web.NotFoundException;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/**
 * Not transactional: marking an article can lose a race to a duplicate key, which the adapter
 * catches, and that must not happen inside a caller's shared transaction.
 */
@Service
public class ArticleService {
  public record AlbumProgress(ArticleAlbum album, int readCount) {}

  public record AlbumDetail(ArticleAlbum album, Map<String, Instant> reads) {}

  public record ArticleView(Article article, ArticleAlbum album, Instant readAt) {}

  private final ArticleCatalog catalog;
  private final ArticleReadRepository reads;
  private final Clock clock;

  public ArticleService(ArticleCatalog catalog, ArticleReadRepository reads, Clock clock) {
    this.catalog = catalog;
    this.reads = reads;
    this.clock = clock;
  }

  public List<AlbumProgress> albums(long userId) {
    Map<String, Instant> read = reads.reads(userId);
    return catalog.albums().stream()
        .map(
            album ->
                new AlbumProgress(
                    album,
                    (int) album.articles().stream().filter(a -> read.containsKey(a.id())).count()))
        .toList();
  }

  public AlbumDetail album(long userId, String albumId) {
    ArticleAlbum album =
        catalog.album(albumId).orElseThrow(() -> new NotFoundException("Album was not found"));
    return new AlbumDetail(album, reads.reads(userId));
  }

  public ArticleView article(long userId, String articleId) {
    ArticleAlbum album =
        catalog
            .albumOf(articleId)
            .orElseThrow(() -> new NotFoundException("Article was not found"));
    Article article = catalog.article(articleId).orElseThrow();
    return new ArticleView(article, album, reads.reads(userId).get(articleId));
  }

  public void setRead(long userId, String articleId, boolean read) {
    if (catalog.article(articleId).isEmpty()) {
      throw new NotFoundException("Article was not found");
    }
    if (read) {
      reads.markRead(userId, articleId, clock.instant());
    } else {
      reads.unmarkRead(userId, articleId);
    }
  }
}
