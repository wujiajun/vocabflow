CREATE TABLE learning_cards (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  user_vocabulary_id BIGINT NOT NULL,
  state VARCHAR(20) NOT NULL,
  step_index INT NOT NULL,
  interval_days INT NOT NULL,
  ease_permille INT NOT NULL,
  due_at DATETIME(6) NULL,
  due_date DATE NULL,
  reps INT NOT NULL,
  lapses INT NOT NULL,
  version INT NOT NULL,
  created_at DATETIME(6) NOT NULL,
  CONSTRAINT uk_learning_card_user_vocabulary UNIQUE (user_vocabulary_id),
  CONSTRAINT fk_learning_card_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_learning_card_user_vocabulary FOREIGN KEY (user_vocabulary_id) REFERENCES user_vocabularies(id)
);

CREATE INDEX ix_learning_cards_user_state ON learning_cards(user_id, state);

CREATE TABLE review_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  user_vocabulary_id BIGINT NOT NULL,
  rating VARCHAR(10) NOT NULL,
  state_before VARCHAR(20) NOT NULL,
  interval_before INT NOT NULL,
  ease_before INT NOT NULL,
  state_after VARCHAR(20) NOT NULL,
  interval_after INT NOT NULL,
  ease_after INT NOT NULL,
  review_date DATE NOT NULL,
  reviewed_at DATETIME(6) NOT NULL,
  CONSTRAINT fk_review_log_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_review_log_user_vocabulary FOREIGN KEY (user_vocabulary_id) REFERENCES user_vocabularies(id)
);

CREATE INDEX ix_review_logs_user_reviewed ON review_logs(user_id, reviewed_at);
