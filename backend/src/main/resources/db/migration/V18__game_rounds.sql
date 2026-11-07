CREATE TABLE game_rounds (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  game VARCHAR(20) NOT NULL,
  stars INT NOT NULL,
  mistakes INT NOT NULL,
  word_count INT NOT NULL,
  study_date DATE NOT NULL,
  finished_at DATETIME(6) NOT NULL,
  CONSTRAINT fk_game_rounds_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_game_rounds_user_date ON game_rounds (user_id, study_date);
