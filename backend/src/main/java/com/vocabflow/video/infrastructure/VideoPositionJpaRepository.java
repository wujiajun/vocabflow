package com.vocabflow.video.infrastructure;

import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface VideoPositionJpaRepository extends JpaRepository<VideoPositionEntity, Long> {
  List<VideoPositionEntity> findByUserId(Long userId);

  /** The number of rows changed: 0 when the user has no place for that video yet. */
  @Transactional
  @Modifying
  @Query(
      "update VideoPositionEntity p set p.positionSeconds = :seconds, p.updatedAt = :at"
          + " where p.userId = :userId and p.videoId = :videoId")
  int update(
      @Param("userId") Long userId,
      @Param("videoId") String videoId,
      @Param("seconds") Integer seconds,
      @Param("at") Instant at);

  @Transactional
  void deleteByUserIdAndVideoId(Long userId, String videoId);
}
