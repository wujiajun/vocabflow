package com.vocabflow.video.infrastructure;

import com.vocabflow.tasks.application.VideoActivity;
import com.vocabflow.video.application.VideoCatalog;
import com.vocabflow.video.application.VideoProgressRepository;
import java.time.Instant;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class VideoTaskActivity implements VideoActivity {
  private final VideoProgressJpaRepository progress;
  private final VideoProgressRepository repository;
  private final VideoCatalog catalog;

  public VideoTaskActivity(
      VideoProgressJpaRepository progress,
      VideoProgressRepository repository,
      VideoCatalog catalog) {
    this.progress = progress;
    this.repository = repository;
    this.catalog = catalog;
  }

  @Override
  public int watchedBetween(long userId, Instant from, Instant to) {
    return progress.countByUserIdAndWatchedAtGreaterThanEqualAndWatchedAtLessThan(userId, from, to);
  }

  @Override
  public boolean unwatchedVideoFor(long userId, int clb) {
    Set<String> watched = repository.watchedVideoIds(userId);
    return catalog.albums().stream()
        .filter(album -> album.clbMin() <= clb && clb <= album.clbMax())
        .anyMatch(album -> album.videos().stream().anyMatch(v -> !watched.contains(v.id())));
  }
}
