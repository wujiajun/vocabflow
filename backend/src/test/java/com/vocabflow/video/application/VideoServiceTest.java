package com.vocabflow.video.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.vocabflow.shared.web.NotFoundException;
import com.vocabflow.video.domain.VideoAlbum;
import com.vocabflow.video.domain.VideoItem;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class VideoServiceTest {
  private static final VideoAlbum ALBUM =
      new VideoAlbum(
          "demo",
          "Demo",
          "Source",
          "",
          1,
          3,
          List.of(
              new VideoItem("WR9_nsLyaEY", "One", "Channel", 100),
              new VideoItem("IEA9LMy-N3M", "Two", "Channel", 900)));

  private final Map<Long, Set<String>> marks = new HashMap<>();
  private final VideoProgressRepository progress =
      new VideoProgressRepository() {
        @Override
        public Set<String> watchedVideoIds(long userId) {
          return marks.getOrDefault(userId, Set.of());
        }

        @Override
        public void markWatched(long userId, String videoId, Instant at) {
          marks.computeIfAbsent(userId, id -> new HashSet<>()).add(videoId);
        }

        @Override
        public void unmarkWatched(long userId, String videoId) {
          marks.getOrDefault(userId, new HashSet<>()).remove(videoId);
        }
      };
  private final VideoService service =
      new VideoService(
          () -> List.of(ALBUM),
          progress,
          Clock.fixed(Instant.parse("2026-11-05T12:00:00Z"), ZoneOffset.UTC));

  @Test
  void countsWatchedVideosPerUser() {
    service.setWatched(1, "WR9_nsLyaEY", true);

    assertThat(service.albums(1).getFirst().watchedCount()).isEqualTo(1);
    assertThat(service.albums(2).getFirst().watchedCount()).isZero();
    assertThat(service.album(1, "demo").watchedVideoIds()).containsExactly("WR9_nsLyaEY");
  }

  @Test
  void aVideoCanBeUnmarkedAgain() {
    service.setWatched(1, "WR9_nsLyaEY", true);
    service.setWatched(1, "WR9_nsLyaEY", false);

    assertThat(service.albums(1).getFirst().watchedCount()).isZero();
  }

  @Test
  void anUnknownAlbumOrVideoIsNotFound() {
    assertThatThrownBy(() -> service.album(1, "nope")).isInstanceOf(NotFoundException.class);
    assertThatThrownBy(() -> service.setWatched(1, "AAAAAAAAAAA", true))
        .isInstanceOf(NotFoundException.class);
  }
}
