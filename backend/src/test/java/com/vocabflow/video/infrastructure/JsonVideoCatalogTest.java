package com.vocabflow.video.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.vocabflow.video.domain.VideoAlbum;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class JsonVideoCatalogTest {
  @Test
  void theCatalogFileInTheAppIsValidAndCoversEveryLevel() {
    JsonVideoCatalog catalog = new JsonVideoCatalog();

    assertThat(catalog.albums()).isNotEmpty();
    assertThat(catalog.albums()).extracting(VideoAlbum::id).doesNotHaveDuplicates();
    for (int level = 1; level <= 12; level += 1) {
      int clb = level;
      assertThat(catalog.albums().stream().anyMatch(a -> a.clbMin() <= clb && clb <= a.clbMax()))
          .as("an album for CLB %d", clb)
          .isTrue();
    }
    assertThat(catalog.hasVideo("WR9_nsLyaEY")).isTrue();
    assertThat(catalog.hasVideo("nope")).isFalse();
    assertThat(catalog.album("ted")).isPresent();
  }

  @Test
  void aCatalogWithADuplicateAlbumOrNoAlbumsIsRefused() {
    String album =
        "{\"id\":\"a\",\"title\":\"T\",\"source\":\"S\",\"clbMin\":1,\"clbMax\":2,\"videos\":"
            + "[{\"id\":\"WR9_nsLyaEY\",\"title\":\"T\",\"channel\":\"C\",\"durationSeconds\":10}]}";
    assertThatThrownBy(() -> parse("{\"albums\":[" + album + "," + album + "]}"))
        .isInstanceOf(IllegalStateException.class);
    assertThatThrownBy(() -> parse("{\"albums\":[]}")).isInstanceOf(IllegalStateException.class);
  }

  private static void parse(String json) throws Exception {
    JsonVideoCatalog.parse(new ByteArrayInputStream(json.getBytes(StandardCharsets.UTF_8)));
  }
}
