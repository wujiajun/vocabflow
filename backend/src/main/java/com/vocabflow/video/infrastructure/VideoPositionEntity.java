package com.vocabflow.video.infrastructure;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(
    name = "video_positions",
    uniqueConstraints =
        @UniqueConstraint(
            name = "uk_video_positions_user_video",
            columnNames = {"user_id", "video_id"}))
public class VideoPositionEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @Column(name = "user_id", nullable = false)
  public Long userId;

  @Column(name = "video_id", nullable = false, length = 20)
  public String videoId;

  @Column(name = "position_seconds", nullable = false)
  public Integer positionSeconds;

  @Column(name = "updated_at", nullable = false)
  public Instant updatedAt;
}
