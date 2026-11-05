package com.vocabflow.video.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import org.junit.jupiter.api.Test;

class VideoAlbumTest {
  private static VideoItem video(String id) {
    return new VideoItem(id, "A title", "A channel", 120);
  }

  @Test
  void aValidAlbumKeepsItsVideosInOrder() {
    VideoAlbum album =
        new VideoAlbum(
            "voa-level-1",
            "Level 1",
            "VOA",
            null,
            1,
            3,
            List.of(video("WR9_nsLyaEY"), video("IEA9LMy-N3M")));

    assertThat(album.videos())
        .extracting(VideoItem::id)
        .containsExactly("WR9_nsLyaEY", "IEA9LMy-N3M");
    assertThat(album.description()).isEmpty();
  }

  @Test
  void refusesAnImpossibleLevelRangeAnEmptyAlbumAndADuplicateVideo() {
    List<VideoItem> one = List.of(video("WR9_nsLyaEY"));
    assertThatThrownBy(() -> new VideoAlbum("a", "T", "S", "", 5, 4, one))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> new VideoAlbum("a", "T", "S", "", 0, 4, one))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> new VideoAlbum("a", "T", "S", "", 1, 13, one))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> new VideoAlbum("a", "T", "S", "", 1, 4, List.of()))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(
            () ->
                new VideoAlbum(
                    "a", "T", "S", "", 1, 4, List.of(video("WR9_nsLyaEY"), video("WR9_nsLyaEY"))))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> new VideoAlbum("Bad Id", "T", "S", "", 1, 4, one))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void aVideoNeedsARealYoutubeIdAndALength() {
    assertThatThrownBy(() -> new VideoItem("short", "T", "C", 10))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> new VideoItem("WR9_nsLyaEY", " ", "C", 10))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> new VideoItem("WR9_nsLyaEY", "T", "C", 0))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
