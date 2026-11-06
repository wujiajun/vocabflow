package com.vocabflow.article.domain;

import java.util.HashSet;
import java.util.List;
import java.util.regex.Pattern;

/**
 * A series of articles from one source, suited to learners from {@code clbMin} to {@code clbMax}
 * (Canadian Language Benchmarks 1 to 12). The articles keep the order they are listed in.
 */
public record ArticleAlbum(
    String id,
    String title,
    String source,
    String description,
    int clbMin,
    int clbMax,
    List<Article> articles) {
  private static final Pattern SLUG = Pattern.compile("[a-z0-9]+(-[a-z0-9]+)*");

  public ArticleAlbum {
    if (id == null || !SLUG.matcher(id).matches()) {
      throw new IllegalArgumentException("Not an album id: " + id);
    }
    if (title == null || title.isBlank() || source == null || source.isBlank()) {
      throw new IllegalArgumentException("Album " + id + " needs a title and a source");
    }
    if (clbMin < 1 || clbMax > 12 || clbMin > clbMax) {
      throw new IllegalArgumentException("Album " + id + " has an impossible CLB range");
    }
    if (articles == null || articles.isEmpty()) {
      throw new IllegalArgumentException("Album " + id + " has no articles");
    }
    var seen = new HashSet<String>();
    for (Article article : articles) {
      if (!seen.add(article.id())) {
        throw new IllegalArgumentException("Album " + id + " lists " + article.id() + " twice");
      }
    }
    description = description == null ? "" : description;
    articles = List.copyOf(articles);
  }
}
