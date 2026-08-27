CREATE TABLE daily_learning_plans (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  learning_date DATE NOT NULL,
  new_vocabulary_goal INT NOT NULL,
  created_at DATETIME(6) NOT NULL,
  CONSTRAINT uk_daily_plan_user_date UNIQUE (user_id, learning_date),
  CONSTRAINT fk_daily_plan_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE daily_learning_plan_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  daily_learning_plan_id BIGINT NOT NULL,
  user_vocabulary_id BIGINT NOT NULL,
  vocabulary_item_id BIGINT NOT NULL,
  item_type VARCHAR(10) NOT NULL,
  term VARCHAR(255) NOT NULL,
  type VARCHAR(30),
  CONSTRAINT uk_daily_plan_user_vocabulary UNIQUE (daily_learning_plan_id, user_vocabulary_id),
  CONSTRAINT uk_daily_plan_vocabulary_item UNIQUE (daily_learning_plan_id, vocabulary_item_id),
  CONSTRAINT fk_daily_plan_item_plan FOREIGN KEY (daily_learning_plan_id) REFERENCES daily_learning_plans(id),
  CONSTRAINT fk_daily_plan_item_user_vocabulary FOREIGN KEY (user_vocabulary_id) REFERENCES user_vocabularies(id),
  CONSTRAINT fk_daily_plan_item_vocabulary_item FOREIGN KEY (vocabulary_item_id) REFERENCES vocabulary_items(id)
);

CREATE INDEX ix_daily_learning_plans_user_date ON daily_learning_plans(user_id, learning_date);
