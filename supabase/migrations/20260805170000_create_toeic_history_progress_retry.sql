-- =====================================================================
-- TOEIC PHASE 9 - HISTORY, PROGRESS, VISIBILITY AND WRONG-QUESTION RETRY
--
-- All projections are owner-scoped and all mutations stay behind RPCs.
-- This migration does not alter the vocabulary/SRS, content-read, media,
-- attempt lifecycle or submission/scoring contracts.
-- =====================================================================

ALTER TABLE public.toeic_test_attempts
    ADD COLUMN IF NOT EXISTS wrong_retry_source_attempt_id UUID
        REFERENCES public.toeic_test_attempts(id)
        ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_toeic_attempts_wrong_retry_source
    ON public.toeic_test_attempts(wrong_retry_source_attempt_id)
    WHERE wrong_retry_source_attempt_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.toeic_test_progress_preferences (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    test_id UUID NOT NULL REFERENCES public.toeic_tests(id) ON DELETE CASCADE,
    hidden BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (user_id, test_id)
);

CREATE INDEX IF NOT EXISTS idx_toeic_progress_preferences_user
    ON public.toeic_test_progress_preferences(user_id, updated_at DESC);

ALTER TABLE public.toeic_test_progress_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toeic_test_progress_preferences FORCE ROW LEVEL SECURITY;

CREATE POLICY toeic_progress_preferences_select_own
    ON public.toeic_test_progress_preferences
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

REVOKE ALL ON TABLE public.toeic_test_progress_preferences FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.list_toeic_attempt_history(
    p_test_id UUID DEFAULT NULL,
    p_mode TEXT DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = 'P0001';
    END IF;
    IF p_mode IS NOT NULL AND p_mode NOT IN ('exam', 'practice') THEN
        RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
    END IF;
    IF p_status IS NOT NULL AND p_status NOT IN ('submitted', 'abandoned', 'expired') THEN
        RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
    END IF;
    IF p_limit IS NULL OR p_limit < 1 OR p_limit > 50
       OR p_offset IS NULL OR p_offset < 0 OR p_offset > 100000 THEN
        RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
    END IF;

    RETURN (
        WITH filtered AS (
            SELECT
                attempt.id,
                attempt.test_id,
                test.name AS test_name,
                test.set_name,
                test.source,
                attempt.mode,
                attempt.status,
                attempt.selected_parts,
                attempt.started_at,
                attempt.submitted_at,
                attempt.submission_result,
                snapshot.total_questions,
                answers.answered_questions
            FROM public.toeic_test_attempts AS attempt
            JOIN public.toeic_tests AS test ON test.id = attempt.test_id
            LEFT JOIN LATERAL (
                SELECT count(*)::INTEGER AS total_questions
                FROM public.toeic_attempt_questions AS attempt_question
                WHERE attempt_question.attempt_id = attempt.id
            ) AS snapshot ON TRUE
            LEFT JOIN LATERAL (
                SELECT count(*) FILTER (WHERE answer.selected_answer IS NOT NULL)::INTEGER AS answered_questions
                FROM public.toeic_test_answers AS answer
                WHERE answer.attempt_id = attempt.id
            ) AS answers ON TRUE
            WHERE attempt.user_id = v_user_id
              AND (p_test_id IS NULL OR attempt.test_id = p_test_id)
              AND (p_mode IS NULL OR attempt.mode = p_mode)
              AND (p_status IS NULL OR attempt.status = p_status)
              AND attempt.status IN ('submitted', 'abandoned', 'expired')
        ), page AS (
            SELECT *
            FROM filtered
            ORDER BY started_at DESC, id DESC
            LIMIT p_limit OFFSET p_offset
        )
        SELECT jsonb_build_object(
            'items', COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'attemptId', page.id,
                        'testId', page.test_id,
                        'testName', page.test_name,
                        'setName', page.set_name,
                        'source', page.source,
                        'mode', page.mode,
                        'status', page.status,
                        'selectedParts', to_jsonb(page.selected_parts),
                        'startedAt', page.started_at,
                        'submittedAt', page.submitted_at,
                        'totalQuestions', page.total_questions,
                        'answeredQuestions', CASE
                            WHEN page.status = 'submitted' THEN (page.submission_result ->> 'answeredQuestions')::INTEGER
                            ELSE page.answered_questions
                        END,
                        'correctQuestions', CASE
                            WHEN page.status = 'submitted' THEN (page.submission_result ->> 'correctQuestions')::INTEGER
                            ELSE NULL
                        END,
                        'listeningCorrect', CASE
                            WHEN page.status = 'submitted' THEN (page.submission_result ->> 'listeningCorrect')::INTEGER
                            ELSE NULL
                        END,
                        'listeningTotal', CASE
                            WHEN page.status = 'submitted' THEN (page.submission_result ->> 'listeningTotal')::INTEGER
                            ELSE NULL
                        END,
                        'readingCorrect', CASE
                            WHEN page.status = 'submitted' THEN (page.submission_result ->> 'readingCorrect')::INTEGER
                            ELSE NULL
                        END,
                        'readingTotal', CASE
                            WHEN page.status = 'submitted' THEN (page.submission_result ->> 'readingTotal')::INTEGER
                            ELSE NULL
                        END
                    )
                    ORDER BY page.started_at DESC, page.id DESC
                )
                FROM page
            ), '[]'::JSONB),
            'limit', p_limit,
            'offset', p_offset,
            'total', (SELECT count(*)::INTEGER FROM filtered)
        )
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_toeic_test_progress(
    p_test_ids UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = 'P0001';
    END IF;
    IF p_test_ids IS NOT NULL
       AND (cardinality(p_test_ids) > 50 OR EXISTS (
           SELECT 1 FROM unnest(p_test_ids) AS requested(test_id) WHERE requested.test_id IS NULL
       )) THEN
        RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
    END IF;

    RETURN (
        WITH candidate_tests AS (
            SELECT test.id
            FROM public.toeic_tests AS test
            WHERE test.status = 'published'
              AND (p_test_ids IS NULL OR test.id = ANY(p_test_ids))
        ), user_attempts AS (
            SELECT attempt.*
            FROM public.toeic_test_attempts AS attempt
            JOIN candidate_tests AS candidate ON candidate.id = attempt.test_id
            WHERE attempt.user_id = v_user_id
        ), submitted AS (
            SELECT
                attempt.id,
                attempt.test_id,
                attempt.mode,
                attempt.selected_parts,
                attempt.submitted_at,
                (attempt.submission_result ->> 'correctQuestions')::INTEGER AS correct_questions,
                (attempt.submission_result ->> 'totalQuestions')::INTEGER AS total_questions
            FROM user_attempts AS attempt
            WHERE attempt.status = 'submitted'
              AND attempt.submission_result IS NOT NULL
        ), ranked AS (
            SELECT
                submitted.*,
                row_number() OVER (
                    PARTITION BY submitted.test_id, submitted.mode
                    ORDER BY
                        submitted.correct_questions::NUMERIC / NULLIF(submitted.total_questions, 0) DESC NULLS LAST,
                        submitted.correct_questions DESC,
                        submitted.submitted_at DESC,
                        submitted.id DESC
                ) AS best_rank
            FROM submitted
        ), best AS (
            SELECT
                ranked.test_id,
                max(ranked.correct_questions) FILTER (WHERE ranked.mode = 'exam' AND ranked.best_rank = 1) AS best_exam_correct,
                max(ranked.total_questions) FILTER (WHERE ranked.mode = 'exam' AND ranked.best_rank = 1) AS best_exam_total,
                max(ranked.correct_questions) FILTER (WHERE ranked.mode = 'practice' AND ranked.best_rank = 1) AS best_practice_correct,
                max(ranked.total_questions) FILTER (WHERE ranked.mode = 'practice' AND ranked.best_rank = 1) AS best_practice_total
            FROM ranked
            GROUP BY ranked.test_id
        ), latest_attempt AS (
            SELECT DISTINCT ON (attempt.test_id)
                attempt.test_id,
                attempt.id,
                attempt.status
            FROM user_attempts AS attempt
            ORDER BY attempt.test_id, attempt.started_at DESC, attempt.id DESC
        ), latest_submitted AS (
            SELECT DISTINCT ON (attempt.test_id)
                attempt.test_id,
                attempt.submitted_at,
                (attempt.submission_result ->> 'correctQuestions')::INTEGER AS correct_questions,
                (attempt.submission_result ->> 'totalQuestions')::INTEGER AS total_questions
            FROM user_attempts AS attempt
            WHERE attempt.status = 'submitted'
              AND attempt.submission_result IS NOT NULL
            ORDER BY attempt.test_id, attempt.submitted_at DESC, attempt.id DESC
        ), completed_parts AS (
            SELECT
                attempt.test_id,
                array_agg(DISTINCT selected_part.part ORDER BY selected_part.part)::SMALLINT[] AS parts
            FROM user_attempts AS attempt
            CROSS JOIN LATERAL unnest(attempt.selected_parts) AS selected_part(part)
            WHERE attempt.status = 'submitted'
            GROUP BY attempt.test_id
        ), aggregate_stats AS (
            SELECT
                attempt.test_id,
                count(*)::INTEGER AS total_attempts,
                count(*) FILTER (WHERE attempt.status = 'submitted')::INTEGER AS submitted_attempts,
                count(*) FILTER (WHERE attempt.status = 'abandoned')::INTEGER AS abandoned_attempts,
                count(*) FILTER (WHERE attempt.status = 'expired')::INTEGER AS expired_attempts,
                bool_or(attempt.status = 'in_progress') AS has_active_attempt
            FROM user_attempts AS attempt
            GROUP BY attempt.test_id
        ), merged AS (
            SELECT
                candidate.id AS test_id,
                COALESCE(stats.total_attempts, 0) AS total_attempts,
                COALESCE(stats.submitted_attempts, 0) AS submitted_attempts,
                COALESCE(stats.abandoned_attempts, 0) AS abandoned_attempts,
                COALESCE(stats.expired_attempts, 0) AS expired_attempts,
                latest_attempt.id AS latest_attempt_id,
                latest_attempt.status AS latest_status,
                latest_submitted.submitted_at AS latest_submitted_at,
                latest_submitted.correct_questions AS latest_correct_questions,
                latest_submitted.total_questions AS latest_total_questions,
                COALESCE(stats.has_active_attempt, FALSE) AS has_active_attempt,
                best.best_exam_correct,
                best.best_exam_total,
                best.best_practice_correct,
                best.best_practice_total,
                completed_parts.parts,
                COALESCE(preference.hidden, FALSE) AS hidden
            FROM candidate_tests AS candidate
            LEFT JOIN aggregate_stats AS stats ON stats.test_id = candidate.id
            LEFT JOIN latest_attempt ON latest_attempt.test_id = candidate.id
            LEFT JOIN latest_submitted ON latest_submitted.test_id = candidate.id
            LEFT JOIN best ON best.test_id = candidate.id
            LEFT JOIN completed_parts ON completed_parts.test_id = candidate.id
            LEFT JOIN public.toeic_test_progress_preferences AS preference
              ON preference.test_id = candidate.id
             AND preference.user_id = v_user_id
        )
        SELECT jsonb_build_object(
            'items', COALESCE(jsonb_agg(
                jsonb_build_object(
                    'testId', merged.test_id,
                    'totalAttempts', merged.total_attempts,
                    'submittedAttempts', merged.submitted_attempts,
                    'abandonedAttempts', merged.abandoned_attempts,
                    'expiredAttempts', merged.expired_attempts,
                    'latestAttemptId', merged.latest_attempt_id,
                    'latestSubmittedAt', merged.latest_submitted_at,
                    'bestCorrectQuestions', COALESCE(merged.best_exam_correct, merged.best_practice_correct),
                    'bestTotalQuestions', COALESCE(merged.best_exam_total, merged.best_practice_total),
                    'bestMode', CASE WHEN merged.best_exam_correct IS NOT NULL THEN 'exam' WHEN merged.best_practice_correct IS NOT NULL THEN 'practice' ELSE NULL END,
                    'bestExamCorrectQuestions', merged.best_exam_correct,
                    'bestExamTotalQuestions', merged.best_exam_total,
                    'bestPracticeCorrectQuestions', merged.best_practice_correct,
                    'bestPracticeTotalQuestions', merged.best_practice_total,
                    'latestCorrectQuestions', merged.latest_correct_questions,
                    'latestTotalQuestions', merged.latest_total_questions,
                    'completedParts', COALESCE(to_jsonb(merged.parts), '[]'::JSONB),
                    'hasActiveAttempt', merged.has_active_attempt,
                    'hiddenFromProgress', merged.hidden
                )
                ORDER BY merged.test_id
            ), '[]'::JSONB)
        )
        FROM merged
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_toeic_test_progress_visibility(
    p_test_id UUID,
    p_hidden BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = 'P0001';
    END IF;
    IF p_test_id IS NULL OR p_hidden IS NULL THEN
        RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.toeic_tests AS test WHERE test.id = p_test_id) THEN
        RAISE EXCEPTION 'TEST_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.toeic_test_progress_preferences (user_id, test_id, hidden)
    VALUES (v_user_id, p_test_id, p_hidden)
    ON CONFLICT (user_id, test_id) DO UPDATE
    SET hidden = EXCLUDED.hidden,
        updated_at = clock_timestamp();

    RETURN jsonb_build_object('testId', p_test_id, 'hidden', p_hidden);
END;
$$;

CREATE OR REPLACE FUNCTION public.start_toeic_wrong_question_attempt(
    p_source_attempt_id UUID,
    p_idempotency_key UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_source RECORD;
    v_existing RECORD;
    v_attempt_id UUID;
    v_selected_parts SMALLINT[];
    v_wrong_count INTEGER;
    v_started_at TIMESTAMPTZ;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = 'P0001';
    END IF;
    IF p_source_attempt_id IS NULL OR p_idempotency_key IS NULL THEN
        RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
    END IF;

    PERFORM pg_advisory_xact_lock(
        hashtextextended(v_user_id::TEXT || ':' || p_idempotency_key::TEXT, 0)
    );

    SELECT attempt.id, attempt.user_id, attempt.test_id, attempt.status
    INTO v_source
    FROM public.toeic_test_attempts AS attempt
    WHERE attempt.id = p_source_attempt_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ATTEMPT_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    IF v_source.user_id <> v_user_id THEN
        RAISE EXCEPTION 'ATTEMPT_NOT_OWNED' USING ERRCODE = 'P0001';
    END IF;
    IF v_source.status <> 'submitted' THEN
        RAISE EXCEPTION 'ATTEMPT_NOT_SUBMITTED' USING ERRCODE = 'P0001';
    END IF;

    SELECT attempt.id, attempt.test_id, attempt.mode,
           attempt.selected_parts, attempt.wrong_retry_source_attempt_id
    INTO v_existing
    FROM public.toeic_test_attempts AS attempt
    WHERE attempt.user_id = v_user_id
      AND attempt.start_idempotency_key = p_idempotency_key
    FOR UPDATE;

    IF FOUND THEN
        IF v_existing.wrong_retry_source_attempt_id IS DISTINCT FROM p_source_attempt_id
           OR v_existing.test_id <> v_source.test_id
           OR v_existing.mode <> 'practice' THEN
            RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
        END IF;
        RETURN public.toeic_attempt_session_json(v_existing.id, clock_timestamp());
    END IF;

    SELECT count(*)::INTEGER
    INTO v_wrong_count
    FROM public.toeic_attempt_questions AS attempt_question
    JOIN public.toeic_test_answers AS answer
      ON answer.attempt_id = attempt_question.attempt_id
     AND answer.question_id = attempt_question.question_id
    WHERE attempt_question.attempt_id = p_source_attempt_id
      AND answer.is_correct IS FALSE;

    IF v_wrong_count = 0 THEN
        RAISE EXCEPTION 'NO_WRONG_QUESTIONS' USING ERRCODE = 'P0001';
    END IF;

    SELECT array_agg(DISTINCT attempt_question.part ORDER BY attempt_question.part)::SMALLINT[]
    INTO v_selected_parts
    FROM public.toeic_attempt_questions AS attempt_question
    JOIN public.toeic_test_answers AS answer
      ON answer.attempt_id = attempt_question.attempt_id
     AND answer.question_id = attempt_question.question_id
    WHERE attempt_question.attempt_id = p_source_attempt_id
      AND answer.is_correct IS FALSE;

    v_started_at := clock_timestamp();
    INSERT INTO public.toeic_test_attempts (
        user_id, test_id, mode, status, selected_parts, started_at,
        deadline_at, start_idempotency_key, wrong_retry_source_attempt_id
    )
    VALUES (
        v_user_id, v_source.test_id, 'practice', 'in_progress', v_selected_parts,
        v_started_at, NULL, p_idempotency_key, p_source_attempt_id
    )
    RETURNING id INTO v_attempt_id;

    INSERT INTO public.toeic_attempt_questions (attempt_id, test_id, question_id, part, position)
    SELECT
        v_attempt_id,
        source_question.test_id,
        source_question.question_id,
        source_question.part,
        source_question.position
    FROM public.toeic_attempt_questions AS source_question
    JOIN public.toeic_test_answers AS answer
      ON answer.attempt_id = source_question.attempt_id
     AND answer.question_id = source_question.question_id
    WHERE source_question.attempt_id = p_source_attempt_id
      AND answer.is_correct IS FALSE
    ORDER BY source_question.position ASC, source_question.question_id ASC;

    RETURN public.toeic_attempt_session_json(v_attempt_id, clock_timestamp());
EXCEPTION
    WHEN unique_violation THEN
        SELECT attempt.id, attempt.test_id, attempt.mode,
               attempt.selected_parts, attempt.wrong_retry_source_attempt_id
        INTO v_existing
        FROM public.toeic_test_attempts AS attempt
        WHERE attempt.user_id = v_user_id
          AND attempt.start_idempotency_key = p_idempotency_key
        FOR UPDATE;
        IF FOUND THEN
            IF v_existing.wrong_retry_source_attempt_id IS DISTINCT FROM p_source_attempt_id
               OR v_existing.test_id <> v_source.test_id
               OR v_existing.mode <> 'practice' THEN
                RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
            END IF;
            RETURN public.toeic_attempt_session_json(v_existing.id, clock_timestamp());
        END IF;
        RAISE EXCEPTION 'DUPLICATE_ACTIVE_ATTEMPT' USING ERRCODE = 'P0001';
END;
$$;

REVOKE ALL ON FUNCTION public.list_toeic_attempt_history(UUID, TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_toeic_test_progress(UUID[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_toeic_test_progress_visibility(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.start_toeic_wrong_question_attempt(UUID, UUID) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.list_toeic_attempt_history(UUID, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_toeic_test_progress(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_toeic_test_progress_visibility(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_toeic_wrong_question_attempt(UUID, UUID) TO authenticated;

COMMENT ON TABLE public.toeic_test_progress_preferences
IS 'Owner-private progress visibility preference. It never deletes attempt or result history.';
COMMENT ON FUNCTION public.list_toeic_attempt_history(UUID, TEXT, TEXT, INTEGER, INTEGER)
IS 'Owner-only paginated attempt history using stored submission results and safe metadata.';
COMMENT ON FUNCTION public.get_toeic_test_progress(UUID[])
IS 'Owner-only test progress aggregate derived from attempts and stored results.';
COMMENT ON FUNCTION public.set_toeic_test_progress_visibility(UUID, BOOLEAN)
IS 'Toggles owner-private progress visibility without changing history.';
COMMENT ON FUNCTION public.start_toeic_wrong_question_attempt(UUID, UUID)
IS 'Creates an idempotent Practice attempt from server-selected incorrect questions of a submitted owner attempt.';
