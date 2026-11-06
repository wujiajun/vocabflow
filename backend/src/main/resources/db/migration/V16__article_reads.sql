CREATE TABLE article_reads (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  article_id VARCHAR(20) NOT NULL,
  read_at DATETIME(6) NOT NULL,
  CONSTRAINT uk_article_reads_user_article UNIQUE (user_id, article_id),
  CONSTRAINT fk_article_reads_user FOREIGN KEY (user_id) REFERENCES users(id)
);
