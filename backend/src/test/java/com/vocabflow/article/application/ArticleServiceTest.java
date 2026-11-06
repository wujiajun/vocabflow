package com.vocabflow.article.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.vocabflow.article.domain.Article;
import com.vocabflow.article.domain.ArticleAlbum;
import com.vocabflow.article.domain.GlossaryWord;
import com.vocabflow.shared.web.NotFoundException;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ArticleServiceTest {
  private static Article article(String id) {
    return new Article(
        id,
        "T" + id,
        LocalDate.of(2025, 1, 1),
        2,
        "https://learningenglish.voanews.com/a/" + id + ".html",
        null,
        List.of("Text."),
        List.of(new GlossaryWord("w", "n. d")));
  }

  private static final ArticleAlbum ALBUM =
      new ArticleAlbum("demo", "Demo", "Src", "", 4, 6, List.of(article("1"), article("2")));
  private final ArticleCatalog catalog = () -> List.of(ALBUM);
  private final Map<Long, Map<String, Instant>> marks = new HashMap<>();
  private final ArticleReadRepository repository =
      new ArticleReadRepository() {
        public Map<String, Instant> reads(long userId) {
          return marks.getOrDefault(userId, Map.of());
        }

        public void markRead(long userId, String articleId, Instant at) {
          marks.computeIfAbsent(userId, id -> new HashMap<>()).putIfAbsent(articleId, at);
        }

        public void unmarkRead(long userId, String articleId) {
          marks.getOrDefault(userId, new HashMap<>()).remove(articleId);
        }
      };
  private final ArticleService service =
      new ArticleService(
          catalog, repository, Clock.fixed(Instant.parse("2025-05-01T00:00:00Z"), ZoneOffset.UTC));

  @Test
  void readMarksAreCountedPerUser() {
    service.setRead(1, "1", true);

    assertThat(service.albums(1).getFirst().readCount()).isEqualTo(1);
    assertThat(service.albums(2).getFirst().readCount()).isZero();
    assertThat(service.article(1, "1").readAt()).isEqualTo(Instant.parse("2025-05-01T00:00:00Z"));
    assertThat(service.article(2, "1").readAt()).isNull();

    service.setRead(1, "1", false);
    assertThat(service.albums(1).getFirst().readCount()).isZero();
  }

  @Test
  void unknownAlbumsAndArticlesAreNotFound() {
    assertThatThrownBy(() -> service.album(1, "nope")).isInstanceOf(NotFoundException.class);
    assertThatThrownBy(() -> service.article(1, "99")).isInstanceOf(NotFoundException.class);
    assertThatThrownBy(() -> service.setRead(1, "99", true)).isInstanceOf(NotFoundException.class);
  }
}
