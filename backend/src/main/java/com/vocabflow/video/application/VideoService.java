package com.vocabflow.video.application;

import com.vocabflow.shared.web.NotFoundException;
import com.vocabflow.video.domain.VideoAlbum;
import java.time.Clock;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;

/**
 * Not transactional: marking a video can lose a race to a duplicate key, which the adapter catches,
 * and that must not happen inside a caller's shared transaction.
 */
@Service
public class VideoService {
  public record AlbumProgress(VideoAlbum album, int watchedCount) {}

  public record AlbumDetail(VideoAlbum album, Set<String> watchedVideoIds) {}

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
    return new AlbumDetail(album, progress.watchedVideoIds(userId));
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
  }
}
