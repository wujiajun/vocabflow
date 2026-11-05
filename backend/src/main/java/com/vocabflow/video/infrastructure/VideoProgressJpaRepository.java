package com.vocabflow.video.infrastructure;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VideoProgressJpaRepository extends JpaRepository<VideoProgressEntity, Long> {
  List<VideoProgressEntity> findByUserId(Long userId);

  boolean existsByUserIdAndVideoId(Long userId, String videoId);

  void deleteByUserIdAndVideoId(Long userId, String videoId);
}
