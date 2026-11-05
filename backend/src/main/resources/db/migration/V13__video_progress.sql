CREATE TABLE video_progress (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  video_id VARCHAR(20) NOT NULL,
  watched_at DATETIME(6) NOT NULL,
  CONSTRAINT uk_video_progress_user_video UNIQUE (user_id, video_id),
  CONSTRAINT fk_video_progress_user FOREIGN KEY (user_id) REFERENCES users(id)
);
