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

  /** Albums made of grammar lessons. */
  static final Set<String> GRAMMAR_ALBUMS = Set.of("voa-grammar", "bbc-6-minute-grammar");

  @Override
  public int grammarWatchedBetween(long userId, Instant from, Instant to) {
    Set<String> grammar =
        catalog.albums().stream()
            .filter(a -> GRAMMAR_ALBUMS.contains(a.id()))
            .flatMap(a -> a.videos().stream())
            .map(v -> v.id())
            .collect(java.util.stream.Collectors.toSet());
    return (int)
        progress
            .findByUserIdAndWatchedAtGreaterThanEqualAndWatchedAtLessThan(userId, from, to)
            .stream()
            .filter(p -> grammar.contains(p.videoId))
            .count();
  }

  @Override
  public boolean unwatchedGrammarVideoFor(long userId, int clb) {
    Set<String> watched = repository.watchedVideoIds(userId);
    return catalog.albums().stream()
        .filter(album -> GRAMMAR_ALBUMS.contains(album.id()))
        .filter(album -> album.clbMin() <= clb && clb <= album.clbMax())
        .anyMatch(album -> album.videos().stream().anyMatch(v -> !watched.contains(v.id())));
  }

  @Override
  public boolean unwatchedVideoFor(long userId, int clb) {
    Set<String> watched = repository.watchedVideoIds(userId);
    return catalog.albums().stream()
        .filter(album -> album.clbMin() <= clb && clb <= album.clbMax())
        .anyMatch(album -> album.videos().stream().anyMatch(v -> !watched.contains(v.id())));
  }
}
