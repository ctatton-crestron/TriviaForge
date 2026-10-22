-- ============================================================================
-- Migration 19: Per-question points, per-question time limits, speed scoring
-- ============================================================================
-- questions.points      - base points for a correct answer (default 1000)
-- questions.time_limit  - seconds; NULL falls back to quiz/global timer
-- participant_answers.points_awarded / response_time_ms - speed-based result
-- game_participants.score now holds total points for new sessions.
-- ============================================================================

ALTER TABLE questions ADD COLUMN IF NOT EXISTS points INT NOT NULL DEFAULT 1000;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS time_limit INT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questions_points_range') THEN
    ALTER TABLE questions ADD CONSTRAINT questions_points_range CHECK (points BETWEEN 1 AND 10000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questions_time_limit_range') THEN
    ALTER TABLE questions ADD CONSTRAINT questions_time_limit_range CHECK (time_limit IS NULL OR time_limit BETWEEN 5 AND 300);
  END IF;
END $$;

ALTER TABLE participant_answers ADD COLUMN IF NOT EXISTS points_awarded INT NOT NULL DEFAULT 0;
ALTER TABLE participant_answers ADD COLUMN IF NOT EXISTS response_time_ms INT;

-- Solo sessions: when the current question was served (server-side timing)
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS current_question_started_at TIMESTAMPTZ;
