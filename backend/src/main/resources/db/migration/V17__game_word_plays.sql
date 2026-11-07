CREATE TABLE game_word_plays (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  user_vocabulary_id BIGINT NOT NULL,
  last_played_at DATETIME(6) NOT NULL,
  play_count INT NOT NULL,
  CONSTRAINT uk_game_word_plays_user_vocabulary UNIQUE (user_id, user_vocabulary_id),
  CONSTRAINT fk_game_word_plays_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_game_word_plays_user_vocabulary FOREIGN KEY (user_vocabulary_id) REFERENCES user_vocabularies(id)
);
