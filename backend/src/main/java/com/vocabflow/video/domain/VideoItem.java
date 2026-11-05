package com.vocabflow.video.domain;

import java.util.regex.Pattern;

/** One YouTube video in an album: its id, title, channel and length. */
public record VideoItem(String id, String title, String channel, int durationSeconds) {
  private static final Pattern YOUTUBE_ID = Pattern.compile("[A-Za-z0-9_-]{11}");

  public VideoItem {
    if (id == null || !YOUTUBE_ID.matcher(id).matches()) {
      throw new IllegalArgumentException("Not a YouTube video id: " + id);
    }
    if (title == null || title.isBlank() || channel == null || channel.isBlank()) {
      throw new IllegalArgumentException("Video " + id + " needs a title and a channel");
    }
    if (durationSeconds <= 0) {
      throw new IllegalArgumentException("Video " + id + " needs a positive length");
    }
  }
}
