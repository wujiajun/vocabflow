ALTER TABLE users MODIFY created_at DATETIME(6) NOT NULL;
ALTER TABLE vocabulary_items MODIFY created_at DATETIME(6) NOT NULL;
ALTER TABLE user_vocabularies MODIFY created_at DATETIME(6) NOT NULL;
ALTER TABLE revoked_tokens MODIFY expires_at DATETIME(6) NOT NULL;
