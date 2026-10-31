ALTER TABLE daily_learning_plans ADD COLUMN extra_new_items INT NOT NULL DEFAULT 0;
ALTER TABLE daily_learning_plans ADD COLUMN finished_at DATETIME(6) NULL;
