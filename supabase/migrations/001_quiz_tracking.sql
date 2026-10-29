-- ==============================================================================
-- Migration: 001_quiz_tracking.sql
-- Description: Hardened Anonymous Assessment & Attempt Tracking Schema
-- Security Focus:
--  - Search-path hijacking prevention (SET search_path = public, pg_temp)
--  - Cryptographic participant secret token authentication (prevents impersonation)
--  - Anti-tampering: Completed attempts are strictly immutable
--  - Server-side score validation: Scores are aggregated on database, not client
--  - Idempotent question submission & duplicate prevention
-- ==============================================================================


-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. PARTICIPANTS TABLE
-- Each participant possesses an anonymous UUID and a secret authentication token.
-- The database stores a SHA-256 digest of the token to prevent database leak attacks.
CREATE TABLE IF NOT EXISTS public.participants (
  id UUID PRIMARY KEY,
  secret_hash TEXT NOT NULL,
  participant_number BIGSERIAL UNIQUE NOT NULL,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. ATTEMPTS TABLE
CREATE TABLE IF NOT EXISTS public.attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  quiz_version TEXT NOT NULL DEFAULT 'v1.0',
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'abandoned')) DEFAULT 'in_progress',
  started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  score NUMERIC(4, 2) NOT NULL DEFAULT 0.00,
  max_score NUMERIC(4, 2) NOT NULL DEFAULT 10.00,
  accuracy NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  correct_count INTEGER NOT NULL DEFAULT 0,
  incorrect_count INTEGER NOT NULL DEFAULT 0,
  total_submissions INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_participant_attempt UNIQUE (participant_id, attempt_number)
);

-- 4. QUESTION RESULTS TABLE
CREATE TABLE IF NOT EXISTS public.question_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.attempts(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL CHECK (question_id >= 1 AND question_id <= 10),
  question_number INTEGER NOT NULL CHECK (question_number >= 1 AND question_number <= 10),
  question_category TEXT,
  is_correct BOOLEAN NOT NULL DEFAULT true,
  submissions_required INTEGER NOT NULL DEFAULT 1 CHECK (submissions_required >= 1),
  score_awarded NUMERIC(3, 2) NOT NULL DEFAULT 1.00,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_attempt_question UNIQUE (attempt_id, question_id)
);

-- 5. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_participants_number ON public.participants(participant_number);
CREATE INDEX IF NOT EXISTS idx_attempts_participant ON public.attempts(participant_id, status);
CREATE INDEX IF NOT EXISTS idx_attempts_rank ON public.attempts(participant_id, status, score DESC, duration_seconds ASC);
CREATE INDEX IF NOT EXISTS idx_question_results_attempt ON public.question_results(attempt_id, question_number);

-- 6. TRUSTED DATABASE SCORING FUNCTION
CREATE OR REPLACE FUNCTION public.calculate_submission_score(submissions INT)
RETURNS NUMERIC(3, 2)
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF submissions <= 1 THEN RETURN 1.00;
  ELSIF submissions = 2 THEN RETURN 0.80;
  ELSIF submissions = 3 THEN RETURN 0.60;
  ELSIF submissions = 4 THEN RETURN 0.40;
  ELSIF submissions = 5 THEN RETURN 0.20;
  ELSE RETURN 0.00;
  END IF;
END;
$$;

-- 7. RPC: REGISTER OR RETRIEVE ANONYMOUS PARTICIPANT WITH SECRET VERIFICATION
-- Prevents impersonation: If a participant ID already exists, the caller MUST provide
-- the matching secret token or the request is rejected with HTTP 403 / exception.
CREATE OR REPLACE FUNCTION public.register_or_get_participant(
  p_id UUID,
  p_secret_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_participant RECORD;
  v_expected_hash TEXT;
BEGIN
  IF p_id IS NULL OR p_secret_token IS NULL OR length(trim(p_secret_token)) < 16 THEN
    RAISE EXCEPTION 'Invalid credentials: ID and secret token are required.';
  END IF;

  v_expected_hash := encode(digest(p_secret_token, 'sha256'), 'hex');

  SELECT * INTO v_participant FROM public.participants WHERE id = p_id;
  
  IF NOT FOUND THEN
    INSERT INTO public.participants (id, secret_hash, label)
    VALUES (p_id, v_expected_hash, 'Pending')
    RETURNING * INTO v_participant;

    UPDATE public.participants
    SET label = 'Student ' || v_participant.participant_number
    WHERE id = p_id
    RETURNING * INTO v_participant;
  ELSE
    -- Authenticate existing participant
    IF v_participant.secret_hash != v_expected_hash THEN
      RAISE EXCEPTION 'Access denied: Provided secret token does not match participant records.';
    END IF;

    UPDATE public.participants
    SET last_seen_at = timezone('utc'::text, now())
    WHERE id = p_id
    RETURNING * INTO v_participant;
  END IF;

  RETURN jsonb_build_object(
    'id', v_participant.id,
    'participant_number', v_participant.participant_number,
    'label', v_participant.label,
    'created_at', v_participant.created_at
  );
END;
$$;

-- 8. RPC: START NEW ATTEMPT (Protected by secret token)
CREATE OR REPLACE FUNCTION public.start_quiz_attempt(
  p_id UUID,
  p_participant_id UUID,
  p_secret_token TEXT,
  p_quiz_version TEXT DEFAULT 'v1.0'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_expected_hash TEXT;
  v_participant RECORD;
  v_attempt_number INT;
  v_attempt RECORD;
BEGIN
  IF p_secret_token IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Secret token is required.';
  END IF;

  v_expected_hash := encode(digest(p_secret_token, 'sha256'), 'hex');

  SELECT * INTO v_participant FROM public.participants WHERE id = p_participant_id;
  IF NOT FOUND OR v_participant.secret_hash != v_expected_hash THEN
    RAISE EXCEPTION 'Unauthorized: Invalid participant credentials.';
  END IF;

  -- Compute next sequential attempt number
  SELECT COALESCE(MAX(attempt_number), 0) + 1
  INTO v_attempt_number
  FROM public.attempts
  WHERE participant_id = p_participant_id;

  INSERT INTO public.attempts (
    id,
    participant_id,
    attempt_number,
    quiz_version,
    status,
    started_at
  )
  VALUES (
    p_id,
    p_participant_id,
    v_attempt_number,
    COALESCE(p_quiz_version, 'v1.0'),
    'in_progress',
    timezone('utc'::text, now())
  )
  RETURNING * INTO v_attempt;

  RETURN jsonb_build_object(
    'id', v_attempt.id,
    'participant_id', v_attempt.participant_id,
    'attempt_number', v_attempt.attempt_number,
    'quiz_version', v_attempt.quiz_version,
    'status', v_attempt.status,
    'started_at', v_attempt.started_at
  );
END;
$$;

-- 9. RPC: RECORD QUESTION RESULT (Idempotent & Immutable once completed)
CREATE OR REPLACE FUNCTION public.record_question_result(
  p_attempt_id UUID,
  p_secret_token TEXT,
  p_question_id INT,
  p_question_number INT,
  p_category TEXT,
  p_submissions INT,
  p_time_spent INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_expected_hash TEXT;
  v_attempt RECORD;
  v_score NUMERIC(3, 2);
  v_result RECORD;
BEGIN
  -- Validate input parameters
  IF p_question_id < 1 OR p_question_id > 10 THEN
    RAISE EXCEPTION 'Invalid question_id: must be between 1 and 10.';
  END IF;
  IF p_submissions < 1 THEN
    RAISE EXCEPTION 'Invalid submissions count: must be at least 1.';
  END IF;

  -- Verify attempt ownership
  SELECT a.*, p.secret_hash
  INTO v_attempt
  FROM public.attempts a
  JOIN public.participants p ON a.participant_id = p.id
  WHERE a.id = p_attempt_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attempt % not found.', p_attempt_id;
  END IF;

  v_expected_hash := encode(digest(p_secret_token, 'sha256'), 'hex');
  IF v_attempt.secret_hash != v_expected_hash THEN
    RAISE EXCEPTION 'Unauthorized: Invalid participant secret for attempt.';
  END IF;

  -- Enforce attempt status: cannot record questions on completed or abandoned attempts
  IF v_attempt.status != 'in_progress' THEN
    RAISE EXCEPTION 'Forbidden: Attempt % is already % and cannot be modified.', p_attempt_id, v_attempt.status;
  END IF;

  v_score := public.calculate_submission_score(p_submissions);

  INSERT INTO public.question_results (
    attempt_id,
    question_id,
    question_number,
    question_category,
    is_correct,
    submissions_required,
    score_awarded,
    time_spent_seconds,
    answered_at
  )
  VALUES (
    p_attempt_id,
    p_question_id,
    p_question_number,
    COALESCE(p_category, 'General'),
    true,
    p_submissions,
    v_score,
    GREATEST(0, p_time_spent),
    timezone('utc'::text, now())
  )
  ON CONFLICT (attempt_id, question_id) DO UPDATE SET
    submissions_required = EXCLUDED.submissions_required,
    score_awarded = EXCLUDED.score_awarded,
    time_spent_seconds = EXCLUDED.time_spent_seconds,
    answered_at = EXCLUDED.answered_at
  RETURNING * INTO v_result;

  RETURN jsonb_build_object(
    'id', v_result.id,
    'attempt_id', v_result.attempt_id,
    'question_id', v_result.question_id,
    'question_number', v_result.question_number,
    'score_awarded', v_result.score_awarded,
    'submissions_required', v_result.submissions_required
  );
END;
$$;

-- 10. RPC: FINALIZE ATTEMPT (Verifies completion & locks record)
CREATE OR REPLACE FUNCTION public.finalize_quiz_attempt(
  p_attempt_id UUID,
  p_secret_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_expected_hash TEXT;
  v_attempt RECORD;
  v_total_score NUMERIC(4, 2);
  v_total_questions INT;
  v_accuracy NUMERIC(5, 2);
  v_total_submissions INT;
  v_duration INT;
  v_started_at TIMESTAMPTZ;
  v_completed_at TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
  -- Authenticate owner
  SELECT a.*, p.secret_hash
  INTO v_attempt
  FROM public.attempts a
  JOIN public.participants p ON a.participant_id = p.id
  WHERE a.id = p_attempt_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attempt not found: %', p_attempt_id;
  END IF;

  v_expected_hash := encode(digest(p_secret_token, 'sha256'), 'hex');
  IF v_attempt.secret_hash != v_expected_hash THEN
    RAISE EXCEPTION 'Unauthorized: Secret token does not match attempt owner.';
  END IF;

  -- Idempotency check: if already finalized, return current state without re-evaluating
  IF v_attempt.status = 'completed' THEN
    RETURN jsonb_build_object(
      'id', v_attempt.id,
      'participant_id', v_attempt.participant_id,
      'attempt_number', v_attempt.attempt_number,
      'status', v_attempt.status,
      'score', v_attempt.score,
      'max_score', v_attempt.max_score,
      'accuracy', v_attempt.accuracy,
      'duration_seconds', v_attempt.duration_seconds,
      'correct_count', v_attempt.correct_count,
      'incorrect_count', v_attempt.incorrect_count,
      'completed_at', v_attempt.completed_at
    );
  END IF;

  -- Count questions answered
  SELECT
    COALESCE(SUM(score_awarded), 0.00),
    COUNT(*),
    COALESCE(SUM(submissions_required), 0)
  INTO
    v_total_score,
    v_total_questions,
    v_total_submissions
  FROM public.question_results
  WHERE attempt_id = p_attempt_id;

  -- Require all 10 questions to be recorded before marking complete
  IF v_total_questions < 10 THEN
    RAISE EXCEPTION 'Incomplete quiz: Only % of 10 questions have been recorded.', v_total_questions;
  END IF;

  v_duration := GREATEST(1, EXTRACT(EPOCH FROM (v_completed_at - v_attempt.started_at))::INT);
  v_accuracy := ROUND((v_total_questions::NUMERIC / 10.0) * 100.0, 2);

  UPDATE public.attempts
  SET
    status = 'completed',
    completed_at = v_completed_at,
    duration_seconds = v_duration,
    score = v_total_score,
    accuracy = v_accuracy,
    correct_count = v_total_questions,
    incorrect_count = GREATEST(0, v_total_submissions - v_total_questions),
    total_submissions = v_total_submissions,
    updated_at = v_completed_at
  WHERE id = p_attempt_id
  RETURNING * INTO v_attempt;

  RETURN jsonb_build_object(
    'id', v_attempt.id,
    'participant_id', v_attempt.participant_id,
    'attempt_number', v_attempt.attempt_number,
    'status', v_attempt.status,
    'score', v_attempt.score,
    'max_score', v_attempt.max_score,
    'accuracy', v_attempt.accuracy,
    'duration_seconds', v_attempt.duration_seconds,
    'correct_count', v_attempt.correct_count,
    'incorrect_count', v_attempt.incorrect_count,
    'completed_at', v_attempt.completed_at
  );
END;
$$;

-- 11. RPC: GET PARTICIPANT STATS (Protected by secret token)
CREATE OR REPLACE FUNCTION public.get_participant_stats(
  p_participant_id UUID,
  p_secret_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_expected_hash TEXT;
  v_participant RECORD;
  v_total_attempts INT;
  v_latest RECORD;
  v_best RECORD;
BEGIN
  v_expected_hash := encode(digest(p_secret_token, 'sha256'), 'hex');

  SELECT * INTO v_participant FROM public.participants WHERE id = p_participant_id;
  IF NOT FOUND OR v_participant.secret_hash != v_expected_hash THEN
    RAISE EXCEPTION 'Unauthorized: Invalid participant credentials.';
  END IF;

  -- Count total completed attempts
  SELECT COUNT(*) INTO v_total_attempts
  FROM public.attempts
  WHERE participant_id = p_participant_id AND status = 'completed';

  -- Latest completed attempt
  SELECT score, accuracy, duration_seconds, completed_at
  INTO v_latest
  FROM public.attempts
  WHERE participant_id = p_participant_id AND status = 'completed'
  ORDER BY completed_at DESC
  LIMIT 1;

  -- Best completed attempt (highest score; tiebreaker: shorter duration)
  SELECT score, accuracy, duration_seconds, completed_at
  INTO v_best
  FROM public.attempts
  WHERE participant_id = p_participant_id AND status = 'completed'
  ORDER BY score DESC, duration_seconds ASC, completed_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'total_attempts', v_total_attempts,
    'latest_score', v_latest.score,
    'latest_accuracy', v_latest.accuracy,
    'latest_duration_seconds', v_latest.duration_seconds,
    'latest_completed_at', v_latest.completed_at,
    'best_score', v_best.score,
    'best_accuracy', v_best.accuracy
  );
END;
$$;

-- 12. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_results ENABLE ROW LEVEL SECURITY;

-- Block all direct table operations from anon/authenticated roles.
-- All operations MUST pass through the vetted SECURITY DEFINER RPC functions.
REVOKE ALL ON public.participants FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.attempts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.question_results FROM PUBLIC, anon, authenticated;

-- Explicitly grant execute only on the vetted RPC functions
GRANT EXECUTE ON FUNCTION public.register_or_get_participant(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_quiz_attempt(UUID, UUID, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_question_result(UUID, TEXT, INT, INT, TEXT, INT, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_quiz_attempt(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_participant_stats(UUID, TEXT) TO anon, authenticated;
