CREATE TABLE video_positions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  video_id VARCHAR(20) NOT NULL,
  position_seconds INT NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  CONSTRAINT uk_video_positions_user_video UNIQUE (user_id, video_id),
  CONSTRAINT fk_video_positions_user FOREIGN KEY (user_id) REFERENCES users(id)
);
