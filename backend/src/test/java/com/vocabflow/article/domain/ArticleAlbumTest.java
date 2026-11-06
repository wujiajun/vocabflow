package com.vocabflow.article.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class ArticleAlbumTest {
  static Article article(String id) {
    return new Article(
        id,
        "Title",
        LocalDate.of(2025, 3, 14),
        3,
        "https://learningenglish.voanews.com/a/" + id + ".html",
        null,
        List.of("First paragraph.", "Second paragraph."),
        List.of(new GlossaryWord("fabric", "n. cloth")));
  }

  @Test
  void anArticleJoinsItsParagraphsWithABlankLine() {
    assertThat(article("1").text()).isEqualTo("First paragraph.\n\nSecond paragraph.");
  }

  @Test
  void anArticleMustLinkBackToVoaAndHaveText() {
    assertThatThrownBy(
            () ->
                new Article(
                    "1",
                    "T",
                    LocalDate.now(),
                    1,
                    "https://example.com/a",
                    null,
                    List.of("x"),
                    null))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(
            () ->
                new Article(
                    "1",
                    "T",
                    LocalDate.now(),
                    1,
                    "https://learningenglish.voanews.com/a/1.html",
                    null,
                    List.of(),
                    null))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void anAlbumRefusesAnImpossibleRangeNoArticlesOrTheSameArticleTwice() {
    assertThatThrownBy(() -> new ArticleAlbum("a", "A", "S", "", 5, 3, List.of(article("1"))))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> new ArticleAlbum("a", "A", "S", "", 1, 3, List.of()))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(
            () -> new ArticleAlbum("a", "A", "S", "", 1, 3, List.of(article("1"), article("1"))))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> new ArticleAlbum("Bad Id", "A", "S", "", 1, 3, List.of(article("1"))))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
