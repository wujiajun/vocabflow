package com.vocabflow.video.adapter;

import com.vocabflow.video.application.VideoService;
import com.vocabflow.video.domain.VideoAlbum;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/videos")
public class VideoController {
  private final VideoService service;

  public VideoController(VideoService service) {
    this.service = service;
  }

  record Album(
      String id,
      String title,
      String source,
      String description,
      int clbMin,
      int clbMax,
      int videoCount,
      int watchedCount,
      String coverVideoId) {}

  record Video(String id, String title, String channel, int durationSeconds, boolean watched) {}

  record AlbumDetail(
      String id,
      String title,
      String source,
      String description,
      int clbMin,
      int clbMax,
      int watchedCount,
      List<Video> videos) {}

  @GetMapping("/albums")
  public List<Album> albums(@AuthenticationPrincipal Long userId) {
    return service.albums(userId).stream()
        .map(
            progress -> {
              VideoAlbum album = progress.album();
              return new Album(
                  album.id(),
                  album.title(),
                  album.source(),
                  album.description(),
                  album.clbMin(),
                  album.clbMax(),
                  album.videos().size(),
                  progress.watchedCount(),
                  album.videos().getFirst().id());
            })
        .toList();
  }

  @GetMapping("/albums/{albumId}")
  public AlbumDetail album(@AuthenticationPrincipal Long userId, @PathVariable String albumId) {
    VideoService.AlbumDetail detail = service.album(userId, albumId);
    VideoAlbum album = detail.album();
    List<Video> videos =
        album.videos().stream()
            .map(
                video ->
                    new Video(
                        video.id(),
                        video.title(),
                        video.channel(),
                        video.durationSeconds(),
                        detail.watchedVideoIds().contains(video.id())))
            .toList();
    return new AlbumDetail(
        album.id(),
        album.title(),
        album.source(),
        album.description(),
        album.clbMin(),
        album.clbMax(),
        (int) videos.stream().filter(Video::watched).count(),
        videos);
  }

  @PutMapping("/{videoId}/watched")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void markWatched(@AuthenticationPrincipal Long userId, @PathVariable String videoId) {
    service.setWatched(userId, videoId, true);
  }

  @DeleteMapping("/{videoId}/watched")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void unmarkWatched(@AuthenticationPrincipal Long userId, @PathVariable String videoId) {
    service.setWatched(userId, videoId, false);
  }
}
