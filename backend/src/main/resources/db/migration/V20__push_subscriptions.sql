-- One row per browser that asked for the daily reminder. The row existing means the reminder is on
-- for that browser; deleting it turns it off. last_sent_date keeps the reminder to one a day.
CREATE TABLE push_subscriptions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  endpoint VARCHAR(512) NOT NULL,
  p256dh VARCHAR(128) NOT NULL,
  auth VARCHAR(64) NOT NULL,
  remind_at TIME NOT NULL,
  device_zone VARCHAR(64) NULL,
  last_sent_date DATE NULL,
  created_at DATETIME(6) NOT NULL,
  CONSTRAINT uk_push_subscriptions_endpoint UNIQUE (endpoint),
  CONSTRAINT fk_push_subscriptions_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions (user_id);
