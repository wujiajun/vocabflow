package com.vocabflow.video.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.vocabflow.shared.web.NotFoundException;
import com.vocabflow.video.domain.VideoAlbum;
import com.vocabflow.video.domain.VideoItem;
import com.vocabflow.video.domain.VideoPlace;
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
  private final Map<Long, Map<String, VideoPlace>> places = new HashMap<>();
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

        @Override
        public Map<String, VideoPlace> positions(long userId) {
          return places.getOrDefault(userId, Map.of());
        }

        @Override
        public void savePosition(long userId, String videoId, int seconds, Instant at) {
          places
              .computeIfAbsent(userId, id -> new HashMap<>())
              .put(videoId, new VideoPlace(seconds, at));
        }

        @Override
        public void clearPosition(long userId, String videoId) {
          places.getOrDefault(userId, new HashMap<>()).remove(videoId);
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
    assertThatThrownBy(() -> service.savePosition(1, "AAAAAAAAAAA", 30))
        .isInstanceOf(NotFoundException.class);
  }

  @Test
  void keepsTheLatestPlaceOfAVideoForTheUserOnly() {
    service.savePosition(1, "IEA9LMy-N3M", 120);
    service.savePosition(1, "IEA9LMy-N3M", 300);

    assertThat(service.album(1, "demo").positions().get("IEA9LMy-N3M"))
        .isEqualTo(new VideoPlace(300, Instant.parse("2026-11-05T12:00:00Z")));
    assertThat(service.album(2, "demo").positions()).isEmpty();
    assertThat(service.album(1, "demo").watchedVideoIds()).isEmpty();
  }

  @Test
  void theFirstSecondsAreNotKeptAndClearAnEarlierPlace() {
    service.savePosition(1, "IEA9LMy-N3M", 200);
    service.savePosition(1, "IEA9LMy-N3M", 4);

    assertThat(service.album(1, "demo").positions()).isEmpty();
  }

  @Test
  void aVideoPlayedToNineTenthsIsWatchedAndLosesItsPlace() {
    service.savePosition(1, "WR9_nsLyaEY", 50);
    service.savePosition(1, "WR9_nsLyaEY", 90);

    assertThat(service.album(1, "demo").watchedVideoIds()).containsExactly("WR9_nsLyaEY");
    assertThat(service.album(1, "demo").positions()).isEmpty();
    // Past the end counts the same.
    service.savePosition(1, "IEA9LMy-N3M", 5000);
    assertThat(service.album(1, "demo").watchedVideoIds()).contains("IEA9LMy-N3M");
  }

  @Test
  void markingOrUnmarkingByHandClearsThePlace() {
    service.savePosition(1, "IEA9LMy-N3M", 300);
    service.setWatched(1, "IEA9LMy-N3M", true);
    assertThat(service.album(1, "demo").positions()).isEmpty();

    service.savePosition(1, "WR9_nsLyaEY", 40);
    service.setWatched(1, "WR9_nsLyaEY", false);
    assertThat(service.album(1, "demo").positions()).isEmpty();
  }
}
