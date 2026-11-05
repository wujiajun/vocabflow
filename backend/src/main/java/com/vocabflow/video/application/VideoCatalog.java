package com.vocabflow.video.application;

import com.vocabflow.video.domain.VideoAlbum;
import java.util.List;
import java.util.Optional;

/** The albums the app offers. Read-only: the assistant that maintains the app changes them. */
public interface VideoCatalog {
  List<VideoAlbum> albums();

  default Optional<VideoAlbum> album(String id) {
    return albums().stream().filter(album -> album.id().equals(id)).findFirst();
  }

  default boolean hasVideo(String videoId) {
    return albums().stream()
        .anyMatch(album -> album.videos().stream().anyMatch(video -> video.id().equals(videoId)));
  }
}
