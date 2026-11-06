package com.vocabflow.article.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.vocabflow.article.domain.ArticleAlbum;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class JsonArticleCatalogTest {
  private static String article(String id, String text) {
    return "{\"id\":\""
        + id
        + "\",\"title\":\"T\",\"publishedOn\":\"2025-03-14\",\"readingMinutes\":2,"
        + "\"sourceUrl\":\"https://learningenglish.voanews.com/a/"
        + id
        + ".html\",\"paragraphs\":[\""
        + text
        + "\"],\"glossary\":[]}";
  }

  private static String album(String id, String articles) {
    return "{\"id\":\""
        + id
        + "\",\"title\":\"T\",\"source\":\"S\",\"clbMin\":4,\"clbMax\":6,\"articles\":["
        + articles
        + "]}";
  }

  @Test
  void theCatalogFileInTheAppIsValid() {
    JsonArticleCatalog catalog = new JsonArticleCatalog();

    assertThat(catalog.albums()).isNotEmpty();
    assertThat(catalog.albums()).extracting(ArticleAlbum::id).doesNotHaveDuplicates();
    ArticleAlbum first = catalog.albums().getFirst();
    String id = first.articles().getFirst().id();
    assertThat(catalog.article(id)).isPresent();
    assertThat(catalog.albumOf(id)).contains(first);
    assertThat(catalog.article("nope")).isEmpty();
    assertThat(catalog.albums())
        .allSatisfy(
            album ->
                assertThat(album.articles())
                    .allSatisfy(
                        article -> {
                          assertThat(article.sourceUrl())
                              .startsWith("https://learningenglish.voanews.com/a/");
                          assertThat(article.text()).doesNotContain("[[");
                        }));
  }

  @Test
  void aCatalogWithADuplicateAlbumDuplicateArticleOrNoAlbumsIsRefused() {
    String one = album("a", article("1", "Hello there."));
    assertThatThrownBy(() -> parse("{\"albums\":[" + one + "," + one + "]}"))
        .isInstanceOf(IllegalStateException.class);
    assertThatThrownBy(
            () ->
                parse(
                    "{\"albums\":[" + one + "," + album("b", article("1", "Hello there.")) + "]}"))
        .isInstanceOf(IllegalStateException.class);
    assertThatThrownBy(() -> parse("{\"albums\":[]}")).isInstanceOf(IllegalStateException.class);
  }

  @Test
  void anArticleThatMentionsAWireServiceIsRefused() {
    String bad = album("a", article("1", "Reporting by Reuters and others."));
    assertThatThrownBy(() -> parse("{\"albums\":[" + bad + "]}"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("wire service");
  }

  private static void parse(String json) throws Exception {
    JsonArticleCatalog.parse(new ByteArrayInputStream(json.getBytes(StandardCharsets.UTF_8)));
  }
}
