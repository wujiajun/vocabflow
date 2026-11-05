package com.vocabflow.video.domain;

import java.util.HashSet;
import java.util.List;
import java.util.regex.Pattern;

/**
 * A series of videos from one source, suited to learners from {@code clbMin} to {@code clbMax}
 * (Canadian Language Benchmarks 1 to 12). The videos keep the order they are listed in.
 */
public record VideoAlbum(
    String id,
    String title,
    String source,
    String description,
    int clbMin,
    int clbMax,
    List<VideoItem> videos) {
  private static final Pattern SLUG = Pattern.compile("[a-z0-9]+(-[a-z0-9]+)*");

  public VideoAlbum {
    if (id == null || !SLUG.matcher(id).matches()) {
      throw new IllegalArgumentException("Not an album id: " + id);
    }
    if (title == null || title.isBlank() || source == null || source.isBlank()) {
      throw new IllegalArgumentException("Album " + id + " needs a title and a source");
    }
    if (clbMin < 1 || clbMax > 12 || clbMin > clbMax) {
      throw new IllegalArgumentException("Album " + id + " has an impossible CLB range");
    }
    if (videos == null || videos.isEmpty()) {
      throw new IllegalArgumentException("Album " + id + " has no videos");
    }
    var seen = new HashSet<String>();
    for (VideoItem video : videos) {
      if (!seen.add(video.id())) {
        throw new IllegalArgumentException("Album " + id + " lists " + video.id() + " twice");
      }
    }
    description = description == null ? "" : description;
    videos = List.copyOf(videos);
  }
}
