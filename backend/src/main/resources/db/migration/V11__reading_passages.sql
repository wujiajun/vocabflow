CREATE TABLE reading_passages (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  study_date DATE NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  words_json TEXT NOT NULL,
  read_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL,
  source VARCHAR(100) NOT NULL,
  CONSTRAINT uk_reading_passage_user_date UNIQUE (user_id, study_date),
  CONSTRAINT fk_reading_passage_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX ix_reading_passages_user_created ON reading_passages(user_id, created_at);
