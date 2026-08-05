CREATE OR REPLACE FUNCTION public.toeic_submission_result_json(
    p_attempt_id UUID,
    p_submitted_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    WITH snapshot AS (
        SELECT
            attempt_question.question_id,
            question.section,
            answer.selected_answer,
            answer.is_correct
        FROM public.toeic_attempt_questions AS attempt_question
        JOIN public.toeic_questions AS question
          ON question.id = attempt_question.question_id
         AND question.test_id = attempt_question.test_id
         AND question.part = attempt_question.part
        LEFT JOIN public.toeic_test_answers AS answer
          ON answer.attempt_id = attempt_question.attempt_id
         AND answer.question_id = attempt_question.question_id
        WHERE attempt_question.attempt_id = p_attempt_id
    ), attempt AS (
        SELECT test_id, mode
        FROM public.toeic_test_attempts
        WHERE id = p_attempt_id
    )
    SELECT jsonb_build_object(
        'version', 1,
        'attemptId', p_attempt_id,
        'testId', attempt.test_id,
        'mode', attempt.mode,
        'status', 'submitted',
        'totalQuestions', count(*)::INTEGER,
        'answeredQuestions', count(*) FILTER (WHERE snapshot.selected_answer IS NOT NULL)::INTEGER,
        'unansweredQuestions', count(*) FILTER (WHERE snapshot.selected_answer IS NULL)::INTEGER,
        'correctQuestions', count(*) FILTER (WHERE snapshot.is_correct IS TRUE)::INTEGER,
        'incorrectQuestions', count(*) FILTER (WHERE snapshot.is_correct IS FALSE)::INTEGER,
        'listeningTotal', count(*) FILTER (WHERE snapshot.section = 'listening')::INTEGER,
        'listeningCorrect', count(*) FILTER (WHERE snapshot.section = 'listening' AND snapshot.is_correct IS TRUE)::INTEGER,
        'readingTotal', count(*) FILTER (WHERE snapshot.section = 'reading')::INTEGER,
        'readingCorrect', count(*) FILTER (WHERE snapshot.section = 'reading' AND snapshot.is_correct IS TRUE)::INTEGER,
        'submittedAt', p_submitted_at,
        'scaledScore', NULL
    )
    FROM snapshot
    CROSS JOIN attempt
    GROUP BY attempt.test_id, attempt.mode;
$$;

CREATE OR REPLACE FUNCTION public.submit_toeic_attempt(
    p_attempt_id UUID,
    p_idempotency_key UUID
)
RETURNS JSONB
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_attempt RECORD;
    v_existing_key RECORD;
    v_snapshot_count INTEGER;
    v_answer_key_count INTEGER;
    v_submitted_at TIMESTAMPTZ := clock_timestamp();
    v_result JSONB;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = 'P0001';
    END IF;
    IF p_attempt_id IS NULL OR p_idempotency_key IS NULL THEN
        RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
    END IF;

    -- Serialize the logical submit key before locking attempt rows. This
    -- makes same-key concurrent requests deterministic across attempts too.
    PERFORM pg_advisory_xact_lock(
        hashtextextended(v_user_id::TEXT || ':' || p_idempotency_key::TEXT, 0)
    );

    SELECT attempt.id, attempt.submission_result
    INTO v_existing_key
    FROM public.toeic_test_attempts AS attempt
    WHERE attempt.user_id = v_user_id
      AND attempt.submit_idempotency_key = p_idempotency_key
    FOR UPDATE;

    IF FOUND AND v_existing_key.id <> p_attempt_id THEN
        RAISE EXCEPTION 'SUBMIT_IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0001';
    END IF;

    SELECT attempt.id, attempt.user_id, attempt.test_id, attempt.mode,
           attempt.status, attempt.submission_result
    INTO v_attempt
    FROM public.toeic_test_attempts AS attempt
    WHERE attempt.id = p_attempt_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ATTEMPT_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    IF v_attempt.user_id <> v_user_id THEN
        RAISE EXCEPTION 'ATTEMPT_NOT_OWNED' USING ERRCODE = 'P0001';
    END IF;

    IF v_attempt.status = 'submitted' THEN
        IF v_attempt.submission_result IS NULL THEN
            RAISE EXCEPTION 'ATTEMPT_NOT_SUBMITTABLE' USING ERRCODE = 'P0001';
        END IF;
        RETURN v_attempt.submission_result;
    END IF;

    IF v_attempt.status = 'abandoned'
       OR (v_attempt.status = 'expired' AND v_attempt.mode <> 'exam')
       OR v_attempt.status NOT IN ('in_progress', 'expired') THEN
        RAISE EXCEPTION 'ATTEMPT_NOT_SUBMITTABLE' USING ERRCODE = 'P0001';
    END IF;

    -- Expiry is intentionally not re-applied here. An in-progress Exam may
    -- be finalized after the browser clock reaches zero, using persisted data.
    -- Phase 5 already marks overdue sessions expired; Exam expired sessions
    -- are also allowed to finalize their persisted answers here.
    SELECT count(*)::INTEGER,
           count(answer_key.question_id)::INTEGER
    INTO v_snapshot_count, v_answer_key_count
    FROM public.toeic_attempt_questions AS attempt_question
    LEFT JOIN public.toeic_question_answer_keys AS answer_key
      ON answer_key.question_id = attempt_question.question_id
    WHERE attempt_question.attempt_id = p_attempt_id;

    IF v_snapshot_count = 0 OR v_snapshot_count <> v_answer_key_count THEN
        RAISE EXCEPTION 'ANSWER_KEY_INCOMPLETE' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.toeic_test_answers AS answer
    SET is_correct = CASE
        WHEN answer.selected_answer IS NULL THEN NULL
        ELSE answer.selected_answer = answer_key.correct_answer
    END
    FROM public.toeic_question_answer_keys AS answer_key
    WHERE answer.attempt_id = p_attempt_id
      AND answer.question_id = answer_key.question_id;

    v_result := public.toeic_submission_result_json(
        p_attempt_id,
        v_submitted_at
    );

    UPDATE public.toeic_test_attempts
    SET status = 'submitted',
        submitted_at = v_submitted_at,
        submit_idempotency_key = p_idempotency_key,
        submission_result = v_result,
        updated_at = clock_timestamp()
    WHERE id = p_attempt_id;

    RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_toeic_attempt_result(
    p_attempt_id UUID
)
RETURNS JSONB
LANGUAGE PLPGSQL
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_attempt RECORD;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = 'P0001';
    END IF;
    IF p_attempt_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
    END IF;

    SELECT attempt.user_id, attempt.status, attempt.submission_result
    INTO v_attempt
    FROM public.toeic_test_attempts AS attempt
    WHERE attempt.id = p_attempt_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ATTEMPT_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    IF v_attempt.user_id <> v_user_id THEN
        RAISE EXCEPTION 'ATTEMPT_NOT_OWNED' USING ERRCODE = 'P0001';
    END IF;
    IF v_attempt.status <> 'submitted' OR v_attempt.submission_result IS NULL THEN
        RAISE EXCEPTION 'ATTEMPT_NOT_SUBMITTED' USING ERRCODE = 'P0001';
    END IF;

    RETURN v_attempt.submission_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_toeic_attempt_review(
    p_attempt_id UUID
)
RETURNS JSONB
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_attempt RECORD;
    v_missing_keys INTEGER;
    v_review JSONB;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = 'P0001';
    END IF;
    IF p_attempt_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
    END IF;

    SELECT attempt.user_id, attempt.test_id, attempt.status
    INTO v_attempt
    FROM public.toeic_test_attempts AS attempt
    WHERE attempt.id = p_attempt_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ATTEMPT_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    IF v_attempt.user_id <> v_user_id THEN
        RAISE EXCEPTION 'ATTEMPT_NOT_OWNED' USING ERRCODE = 'P0001';
    END IF;
    IF v_attempt.status <> 'submitted' THEN
        RAISE EXCEPTION 'ATTEMPT_NOT_SUBMITTED' USING ERRCODE = 'P0001';
    END IF;

    SELECT count(*)::INTEGER
    INTO v_missing_keys
    FROM public.toeic_attempt_questions AS attempt_question
    LEFT JOIN public.toeic_question_answer_keys AS answer_key
      ON answer_key.question_id = attempt_question.question_id
    WHERE attempt_question.attempt_id = p_attempt_id
      AND answer_key.question_id IS NULL;
    IF v_missing_keys > 0 THEN
        RAISE EXCEPTION 'ANSWER_KEY_INCOMPLETE' USING ERRCODE = 'P0001';
    END IF;

    SELECT jsonb_build_object(
        'attemptId', p_attempt_id,
        'testId', v_attempt.test_id,
        'status', 'submitted',
        'items', COALESCE(jsonb_agg(
            jsonb_build_object(
                'questionId', attempt_question.question_id,
                'questionNumber', question.question_number,
                'part', attempt_question.part,
                'passageId', question.passage_id,
                'selectedAnswer', answer.selected_answer,
                'correctAnswer', answer_key.correct_answer,
                'isCorrect', answer.is_correct,
                'isFlagged', COALESCE(answer.is_flagged, FALSE)
            )
            ORDER BY attempt_question.position ASC, attempt_question.question_id ASC
        ), '[]'::JSONB)
    )
    INTO v_review
    FROM public.toeic_attempt_questions AS attempt_question
    JOIN public.toeic_questions AS question
      ON question.id = attempt_question.question_id
     AND question.test_id = attempt_question.test_id
     AND question.part = attempt_question.part
    JOIN public.toeic_question_answer_keys AS answer_key
      ON answer_key.question_id = attempt_question.question_id
    LEFT JOIN public.toeic_test_answers AS answer
      ON answer.attempt_id = attempt_question.attempt_id
     AND answer.question_id = attempt_question.question_id
    WHERE attempt_question.attempt_id = p_attempt_id;

    RETURN v_review;
END;
$$;

REVOKE ALL ON FUNCTION public.toeic_submission_result_json(UUID, TIMESTAMPTZ)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_toeic_attempt(UUID, UUID)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_toeic_attempt_result(UUID)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_toeic_attempt_review(UUID)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.submit_toeic_attempt(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_toeic_attempt_result(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_toeic_attempt_review(UUID) TO authenticated;

COMMENT ON FUNCTION public.submit_toeic_attempt(UUID, UUID)
IS 'Atomically scores an owner attempt from server-side answer keys, stores a versioned summary, and closes the attempt.';
COMMENT ON FUNCTION public.get_toeic_attempt_result(UUID)
IS 'Returns the stored owner-only TOEIC result summary without rescoring.';
COMMENT ON FUNCTION public.get_toeic_attempt_review(UUID)
IS 'Returns owner-only selected/correct answer review rows only after submission.';
