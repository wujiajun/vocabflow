-- One row per user and study day: the single row racing requests fight over when the day's list is
-- made, so that exactly one of them writes the whole list.
CREATE TABLE daily_task_days (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  study_date DATE NOT NULL,
  created_at DATETIME(6) NOT NULL,
  CONSTRAINT uk_daily_task_days_user_date UNIQUE (user_id, study_date),
  CONSTRAINT fk_daily_task_days_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE daily_tasks (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  study_date DATE NOT NULL,
  position INT NOT NULL,
  task_key VARCHAR(40) NOT NULL,
  task_type VARCHAR(30) NOT NULL,
  category VARCHAR(20) NOT NULL,
  param VARCHAR(20) NULL,
  target INT NOT NULL,
  points INT NOT NULL,
  completed_at DATETIME(6) NULL,
  CONSTRAINT uk_daily_tasks_user_date_key UNIQUE (user_id, study_date, task_key),
  CONSTRAINT fk_daily_tasks_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_daily_tasks_user_category ON daily_tasks (user_id, category, study_date);

CREATE TABLE point_ledger (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  study_date DATE NOT NULL,
  entry_key VARCHAR(40) NOT NULL,
  amount INT NOT NULL,
  reason VARCHAR(120) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  CONSTRAINT uk_point_ledger_user_date_key UNIQUE (user_id, study_date, entry_key),
  CONSTRAINT fk_point_ledger_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_point_ledger_user_created ON point_ledger (user_id, id);
