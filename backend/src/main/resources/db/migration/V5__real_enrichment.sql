ALTER TABLE vocabulary_items ADD COLUMN enrichment_started_at DATETIME(6) NULL;
ALTER TABLE vocabulary_items ADD COLUMN enrichment_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE vocabulary_items ADD COLUMN enriched_at DATETIME(6) NULL;
ALTER TABLE vocabulary_items ADD COLUMN enrichment_source VARCHAR(100) NULL;

CREATE TABLE enrichment_usage (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  usage_date DATE NOT NULL,
  request_count INT NOT NULL,
  CONSTRAINT uk_enrichment_usage_user_date UNIQUE (user_id, usage_date),
  CONSTRAINT fk_enrichment_usage_user FOREIGN KEY (user_id) REFERENCES users(id)
);
