package com.vocabflow.article.adapter;

import com.vocabflow.article.application.ArticleService;
import com.vocabflow.article.domain.Article;
import com.vocabflow.article.domain.ArticleAlbum;
import com.vocabflow.article.domain.GlossaryWord;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/articles")
public class ArticleController {
  private final ArticleService service;

  public ArticleController(ArticleService service) {
    this.service = service;
  }

  record Album(
      String id,
      String title,
      String source,
      String description,
      int clbMin,
      int clbMax,
      int articleCount,
      int readCount) {}

  record Summary(
      String id, String title, LocalDate publishedOn, int readingMinutes, boolean read) {}

  record AlbumDetail(
      String id,
      String title,
      String source,
      String description,
      int clbMin,
      int clbMax,
      int readCount,
      List<Summary> articles) {}

  record Glossary(String word, String definition) {}

  record Detail(
      String id,
      String title,
      String albumId,
      String albumTitle,
      String source,
      LocalDate publishedOn,
      int readingMinutes,
      String sourceUrl,
      String audioUrl,
      String text,
      List<Glossary> glossary,
      boolean read,
      Instant readAt) {}

  @GetMapping("/albums")
  public List<Album> albums(@AuthenticationPrincipal Long userId) {
    return service.albums(userId).stream()
        .map(
            progress -> {
              ArticleAlbum album = progress.album();
              return new Album(
                  album.id(),
                  album.title(),
                  album.source(),
                  album.description(),
                  album.clbMin(),
                  album.clbMax(),
                  album.articles().size(),
                  progress.readCount());
            })
        .toList();
  }

  @GetMapping("/albums/{albumId}")
  public AlbumDetail album(@AuthenticationPrincipal Long userId, @PathVariable String albumId) {
    ArticleService.AlbumDetail detail = service.album(userId, albumId);
    ArticleAlbum album = detail.album();
    List<Summary> articles =
        album.articles().stream()
            .map(
                article ->
                    new Summary(
                        article.id(),
                        article.title(),
                        article.publishedOn(),
                        article.readingMinutes(),
                        detail.reads().containsKey(article.id())))
            .toList();
    return new AlbumDetail(
        album.id(),
        album.title(),
        album.source(),
        album.description(),
        album.clbMin(),
        album.clbMax(),
        (int) articles.stream().filter(Summary::read).count(),
        articles);
  }

  @GetMapping("/{articleId}")
  public Detail article(@AuthenticationPrincipal Long userId, @PathVariable String articleId) {
    ArticleService.ArticleView view = service.article(userId, articleId);
    Article article = view.article();
    return new Detail(
        article.id(),
        article.title(),
        view.album().id(),
        view.album().title(),
        view.album().source(),
        article.publishedOn(),
        article.readingMinutes(),
        article.sourceUrl(),
        article.audioUrl(),
        article.text(),
        article.glossary().stream()
            .map((GlossaryWord word) -> new Glossary(word.word(), word.definition()))
            .toList(),
        view.readAt() != null,
        view.readAt());
  }

  @PutMapping("/{articleId}/read")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void markRead(@AuthenticationPrincipal Long userId, @PathVariable String articleId) {
    service.setRead(userId, articleId, true);
  }

  @DeleteMapping("/{articleId}/read")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void unmarkRead(@AuthenticationPrincipal Long userId, @PathVariable String articleId) {
    service.setRead(userId, articleId, false);
  }
}
