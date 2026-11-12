-- The latest Speak this scene result of a learner for a scenario: the share of words right (0-100) and when.
-- Speaking a scenario also marks it finished, so the row may be made by either.
ALTER TABLE scenario_progress ADD COLUMN speaking_score INT NULL;
ALTER TABLE scenario_progress ADD COLUMN spoken_at DATETIME(6) NULL;
