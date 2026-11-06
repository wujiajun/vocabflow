package com.vocabflow.article.application;

import com.vocabflow.article.domain.Article;
import com.vocabflow.article.domain.ArticleAlbum;
import java.util.List;
import java.util.Optional;

/** The albums the app offers. Read-only: the assistant that maintains the app changes them. */
public interface ArticleCatalog {
  List<ArticleAlbum> albums();

  default Optional<ArticleAlbum> album(String id) {
    return albums().stream().filter(album -> album.id().equals(id)).findFirst();
  }

  default Optional<ArticleAlbum> albumOf(String articleId) {
    return albums().stream()
        .filter(album -> album.articles().stream().anyMatch(a -> a.id().equals(articleId)))
        .findFirst();
  }

  default Optional<Article> article(String articleId) {
    return albums().stream()
        .flatMap(album -> album.articles().stream())
        .filter(article -> article.id().equals(articleId))
        .findFirst();
  }
}
