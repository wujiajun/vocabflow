package com.vocabflow.video.application;

import com.vocabflow.shared.web.NotFoundException;
import com.vocabflow.video.domain.VideoAlbum;
import com.vocabflow.video.domain.VideoItem;
import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;

/**
 * Not transactional: marking a video can lose a race to a duplicate key, which the adapter catches,
 * and that must not happen inside a caller's shared transaction.
 */
@Service
public class VideoService {
  public record AlbumProgress(VideoAlbum album, int watchedCount) {}

  public record AlbumDetail(
      VideoAlbum album, Set<String> watchedVideoIds, Map<String, Integer> positions) {}

  /** Seconds before which a place is not kept. */
  static final int MIN_POSITION_SECONDS = 10;

  /** The share of a video after which it counts as watched. */
  static final double FINISHED_SHARE = 0.9;

  private final VideoCatalog catalog;
  private final VideoProgressRepository progress;
  private final Clock clock;

  public VideoService(VideoCatalog catalog, VideoProgressRepository progress, Clock clock) {
    this.catalog = catalog;
    this.progress = progress;
    this.clock = clock;
  }

  public List<AlbumProgress> albums(long userId) {
    Set<String> watched = progress.watchedVideoIds(userId);
    return catalog.albums().stream()
        .map(
            album ->
                new AlbumProgress(
                    album,
                    (int) album.videos().stream().filter(v -> watched.contains(v.id())).count()))
        .toList();
  }

  public AlbumDetail album(long userId, String albumId) {
    VideoAlbum album =
        catalog.album(albumId).orElseThrow(() -> new NotFoundException("Album was not found"));
    return new AlbumDetail(album, progress.watchedVideoIds(userId), progress.positions(userId));
  }

  public void setWatched(long userId, String videoId, boolean watched) {
    if (!catalog.hasVideo(videoId)) {
      throw new NotFoundException("Video was not found");
    }
    if (watched) {
      progress.markWatched(userId, videoId, clock.instant());
    } else {
      progress.unmarkWatched(userId, videoId);
    }
    // Marked or unmarked by hand, a video starts over: its place is cleared with it.
    progress.clearPosition(userId, videoId);
  }

  /**
   * Remembers where the learner stopped. The first few seconds are not worth keeping, and a video
   * played to about nine tenths of its length counts as watched, which also clears its place.
   */
  public void savePosition(long userId, String videoId, int seconds) {
    VideoItem video =
        catalog.video(videoId).orElseThrow(() -> new NotFoundException("Video was not found"));
    if (seconds >= video.durationSeconds() * FINISHED_SHARE) {
      progress.markWatched(userId, videoId, clock.instant());
      progress.clearPosition(userId, videoId);
    } else if (seconds < MIN_POSITION_SECONDS) {
      progress.clearPosition(userId, videoId);
    } else {
      progress.savePosition(userId, videoId, seconds, clock.instant());
    }
  }
}
