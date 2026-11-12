CREATE TABLE scenario_progress (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  scenario_id VARCHAR(60) NOT NULL,
  completed_at DATETIME(6) NOT NULL,
  best_score INT NULL,
  CONSTRAINT uk_scenario_progress_user_scenario UNIQUE (user_id, scenario_id),
  CONSTRAINT fk_scenario_progress_user FOREIGN KEY (user_id) REFERENCES users(id)
);
