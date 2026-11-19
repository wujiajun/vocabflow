-- One key per learner for adding words from outside the app (a macOS Shortcut, say) without opening it. The key
-- can only add words; only its SHA-256 hash is kept, so the key itself is shown once, when it is made.
CREATE TABLE quick_add_keys (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  key_hash VARCHAR(64) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  last_used_at DATETIME(6) NULL,
  CONSTRAINT uk_quick_add_keys_user UNIQUE (user_id),
  CONSTRAINT uk_quick_add_keys_hash UNIQUE (key_hash),
  CONSTRAINT fk_quick_add_keys_user FOREIGN KEY (user_id) REFERENCES users(id)
);
