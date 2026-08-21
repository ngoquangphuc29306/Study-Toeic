-- =====================================================================
-- TOEIC PHASE 5 - SERVER-AUTHORITATIVE ATTEMPT LIFECYCLE
--
-- This migration deliberately does not edit the Phase 2/3 schema
-- migrations. Browser roles use RPCs for attempt creation, autosave,
-- resume and abandon. Answer keys and scoring remain server-only.
-- =====================================================================

ALTER TABLE public.toeic_test_attempts
    ADD COLUMN IF NOT EXISTS start_idempotency_key UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_toeic_attempts_user_start_idempotency
    ON public.toeic_test_attempts(user_id, start_idempotency_key)
    WHERE start_idempotency_key IS NOT NULL;

-- An exam cannot be silently duplicated while it is in progress.
CREATE UNIQUE INDEX IF NOT EXISTS idx_toeic_active_exam_per_user_test
    ON public.toeic_test_attempts(user_id, test_id)
    WHERE status = 'in_progress' AND mode = 'exam';

-- Practice allows multiple histories, but not two active attempts for the
-- same user/test/selected-parts combination.
CREATE UNIQUE INDEX IF NOT EXISTS idx_toeic_active_practice_per_selection
    ON public.toeic_test_attempts(user_id, test_id, selected_parts)
    WHERE status = 'in_progress' AND mode = 'practice';

CREATE TABLE public.toeic_attempt_mutations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,
    attempt_id UUID NOT NULL
        REFERENCES public.toeic_test_attempts(id)
        ON DELETE CASCADE,
    mutation_key UUID NOT NULL,
    mutation_type TEXT NOT NULL
        CHECK (mutation_type IN ('save_answers')),
    result JSONB NOT NULL
        CHECK (jsonb_typeof(result) = 'object'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT toeic_attempt_mutations_user_key_unique
        UNIQUE (user_id, mutation_key)
);

CREATE INDEX idx_toeic_attempt_mutations_attempt_created
    ON public.toeic_attempt_mutations(attempt_id, created_at DESC);

ALTER TABLE public.toeic_attempt_mutations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toeic_attempt_mutations FORCE ROW LEVEL SECURITY;

-- No browser policy or table privilege is created for the mutation ledger.
-- SECURITY DEFINER RPCs are the only access path.
REVOKE ALL ON TABLE public.toeic_attempt_mutations
FROM PUBLIC, anon, authenticated;

-- Attempt and answer payloads are also read through the explicit session
-- projection, so is_correct cannot be selected by a browser role.
REVOKE SELECT ON TABLE public.toeic_test_attempts,
    public.toeic_attempt_questions,
    public.toeic_test_answers
FROM authenticated;

CREATE OR REPLACE FUNCTION public.toeic_attempt_session_json(
    p_attempt_id UUID,
    p_server_now TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_attempt RECORD;
BEGIN
    SELECT
        attempt.id,
        attempt.test_id,
        attempt.mode,
        attempt.status,
        attempt.selected_parts,
        attempt.started_at,
        attempt.deadline_at,
        (SELECT count(*)::INTEGER
         FROM public.toeic_attempt_questions AS snapshot
         WHERE snapshot.attempt_id = attempt.id) AS total_questions
    INTO v_attempt
    FROM public.toeic_test_attempts AS attempt
    WHERE attempt.id = p_attempt_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ATTEMPT_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;

    RETURN jsonb_build_object(
        'attemptId', v_attempt.id,
        'testId', v_attempt.test_id,
        'mode', v_attempt.mode,
        'status', v_attempt.status,
        'selectedParts', to_jsonb(v_attempt.selected_parts),
        'startedAt', v_attempt.started_at,
        'deadlineAt', v_attempt.deadline_at,
        'totalQuestions', v_attempt.total_questions,
        'questions', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'questionId', snapshot.question_id,
                    'part', snapshot.part,
                    'position', snapshot.position
                )
                ORDER BY snapshot.position ASC, snapshot.question_id ASC
            )
            FROM public.toeic_attempt_questions AS snapshot
            WHERE snapshot.attempt_id = v_attempt.id
        ), '[]'::JSONB),
        'answers', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'questionId', answer.question_id,
                    'selectedAnswer', answer.selected_answer,
                    'isFlagged', answer.is_flagged,
                    'answeredAt', answer.answered_at,
                    'timeSpentSeconds', answer.time_spent_seconds,
                    'updatedAt', answer.updated_at
                )
                ORDER BY answer.question_id ASC
            )
            FROM public.toeic_test_answers AS answer
            WHERE answer.attempt_id = v_attempt.id
        ), '[]'::JSONB),
        'serverNow', p_server_now,
        'remainingSeconds', CASE
            WHEN v_attempt.deadline_at IS NULL THEN NULL
            ELSE GREATEST(
                0,
                FLOOR(EXTRACT(EPOCH FROM (v_attempt.deadline_at - p_server_now)))::INTEGER
            )
        END
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_toeic_attempt_if_due(
    p_attempt_id UUID,
    p_server_now TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    UPDATE public.toeic_test_attempts
    SET status = 'expired',
        updated_at = clock_timestamp()
    WHERE id = p_attempt_id
      AND status = 'in_progress'
      AND deadline_at IS NOT NULL
      AND deadline_at <= p_server_now;
$$;

CREATE OR REPLACE FUNCTION public.start_toeic_attempt(
    p_test_id UUID,
    p_mode TEXT,
    p_selected_parts SMALLINT[],
    p_idempotency_key UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_test RECORD;
    v_existing RECORD;
    v_active RECORD;
    v_started_at TIMESTAMPTZ;
    v_deadline_at TIMESTAMPTZ;
    v_expected_count INTEGER;
    v_snapshot_count INTEGER;
    v_server_now TIMESTAMPTZ := clock_timestamp();
    v_selected_parts SMALLINT[] := p_selected_parts;
    v_attempt_id UUID;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = 'P0001';
    END IF;
    IF p_test_id IS NULL OR p_idempotency_key IS NULL
       OR p_mode NOT IN ('exam', 'practice') THEN
        RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
    END IF;
    IF NOT public.is_valid_toeic_parts(v_selected_parts) THEN
        RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
    END IF;
    IF p_mode = 'exam'
       AND v_selected_parts <> ARRAY[1, 2, 3, 4, 5, 6, 7]::SMALLINT[] THEN
        RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
    END IF;

    -- Serialize retries for the same logical start action. This prevents a
    -- concurrent retry from creating a second attempt before the unique index
    -- is consulted.
    PERFORM pg_advisory_xact_lock(
        hashtextextended(v_user_id::TEXT || ':' || p_idempotency_key::TEXT, 0)
    );

    SELECT test.id, test.status, test.duration_seconds, test.total_questions
    INTO v_test
    FROM public.toeic_tests AS test
    WHERE test.id = p_test_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'TEST_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    IF v_test.status <> 'published' THEN
        RAISE EXCEPTION 'TEST_NOT_PUBLISHED' USING ERRCODE = 'P0001';
    END IF;

    -- Idempotency is checked before active-attempt reuse.
    SELECT *
    INTO v_existing
    FROM public.toeic_test_attempts AS attempt
    WHERE attempt.user_id = v_user_id
      AND attempt.start_idempotency_key = p_idempotency_key
    FOR UPDATE;

    IF FOUND THEN
        IF v_existing.test_id <> p_test_id
           OR v_existing.mode <> p_mode
           OR v_existing.selected_parts <> v_selected_parts THEN
            RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
        END IF;
        PERFORM public.expire_toeic_attempt_if_due(v_existing.id, v_server_now);
        RETURN public.toeic_attempt_session_json(v_existing.id, clock_timestamp());
    END IF;

    -- Active attempt rules: one exam per user/test and one practice attempt
    -- per user/test/selected-parts. A different start key gets a stable
    -- conflict instead of being silently associated with an existing key.
    SELECT *
    INTO v_active
    FROM public.toeic_test_attempts AS attempt
    WHERE attempt.user_id = v_user_id
      AND attempt.test_id = p_test_id
      AND attempt.status = 'in_progress'
      AND (
          (p_mode = 'exam' AND attempt.mode = 'exam')
          OR (
              p_mode = 'practice'
              AND attempt.mode = 'practice'
              AND attempt.selected_parts = v_selected_parts
          )
      )
    ORDER BY attempt.created_at ASC, attempt.id ASC
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
        PERFORM public.expire_toeic_attempt_if_due(v_active.id, v_server_now);
        RAISE EXCEPTION 'DUPLICATE_ACTIVE_ATTEMPT' USING ERRCODE = 'P0001';
    END IF;

    v_started_at := clock_timestamp();
    v_deadline_at := CASE
        WHEN p_mode = 'exam'
        THEN v_started_at + make_interval(secs => v_test.duration_seconds)
        ELSE NULL
    END;

    INSERT INTO public.toeic_test_attempts (
        user_id,
        test_id,
        mode,
        status,
        selected_parts,
        started_at,
        deadline_at,
        start_idempotency_key
    )
    VALUES (
        v_user_id,
        p_test_id,
        p_mode,
        'in_progress',
        v_selected_parts,
        v_started_at,
        v_deadline_at,
        p_idempotency_key
    )
    RETURNING id INTO v_attempt_id;

    INSERT INTO public.toeic_attempt_questions (
        attempt_id,
        test_id,
        question_id,
        part,
        position
    )
    SELECT
        v_attempt_id,
        question.test_id,
        question.id,
        question.part,
        question.position
    FROM public.toeic_questions AS question
    WHERE question.test_id = p_test_id
      AND question.part = ANY(v_selected_parts)
    ORDER BY question.position ASC, question.question_number ASC, question.id ASC;

    SELECT count(*)::INTEGER
    INTO v_snapshot_count
    FROM public.toeic_attempt_questions AS snapshot
    WHERE snapshot.attempt_id = v_attempt_id;

    SELECT count(*)::INTEGER
    INTO v_expected_count
    FROM public.toeic_questions AS question
    WHERE question.test_id = p_test_id
      AND question.part = ANY(v_selected_parts);

    IF v_expected_count = 0 OR v_snapshot_count <> v_expected_count THEN
        RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
    END IF;

    RETURN public.toeic_attempt_session_json(v_attempt_id, clock_timestamp());
EXCEPTION
    WHEN unique_violation THEN
        -- A concurrent active-attempt race is resolved by a stable conflict,
        -- never by creating a duplicate.
        SELECT *
        INTO v_active
        FROM public.toeic_test_attempts AS attempt
        WHERE attempt.user_id = v_user_id
          AND attempt.test_id = p_test_id
          AND attempt.status = 'in_progress'
          AND (
              (p_mode = 'exam' AND attempt.mode = 'exam')
              OR (
                  p_mode = 'practice'
                  AND attempt.mode = 'practice'
                  AND attempt.selected_parts = v_selected_parts
              )
          )
        ORDER BY attempt.created_at ASC, attempt.id ASC
        LIMIT 1;
        IF FOUND THEN
            RAISE EXCEPTION 'DUPLICATE_ACTIVE_ATTEMPT' USING ERRCODE = 'P0001';
        END IF;
        RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
END;
$$;

CREATE OR REPLACE FUNCTION public.save_toeic_attempt_answers(
    p_attempt_id UUID,
    p_answers JSONB,
    p_mutation_key UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_attempt RECORD;
    v_existing_mutation RECORD;
    v_item JSONB;
    v_question_id UUID;
    v_seen_questions UUID[] := ARRAY[]::UUID[];
    v_selected_answer TEXT;
    v_server_now TIMESTAMPTZ := clock_timestamp();
    v_saved_result JSONB;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = 'P0001';
    END IF;
    IF p_attempt_id IS NULL OR p_mutation_key IS NULL
       OR jsonb_typeof(p_answers) <> 'array'
       OR jsonb_array_length(p_answers) < 1
       OR jsonb_array_length(p_answers) > 50 THEN
        RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
    END IF;

    PERFORM pg_advisory_xact_lock(
        hashtextextended(v_user_id::TEXT || ':' || p_mutation_key::TEXT, 0)
    );

    SELECT mutation.mutation_type, mutation.result
    INTO v_existing_mutation
    FROM public.toeic_attempt_mutations AS mutation
    WHERE mutation.user_id = v_user_id
      AND mutation.mutation_key = p_mutation_key
    FOR UPDATE;

    IF FOUND THEN
        IF v_existing_mutation.mutation_type <> 'save_answers' THEN
            RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
        END IF;
        RETURN v_existing_mutation.result;
    END IF;

    SELECT attempt.id, attempt.user_id, attempt.status, attempt.deadline_at
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
    IF v_attempt.status = 'expired'
       OR (
           v_attempt.status = 'in_progress'
           AND v_attempt.deadline_at IS NOT NULL
           AND v_attempt.deadline_at <= v_server_now
       ) THEN
        PERFORM public.expire_toeic_attempt_if_due(p_attempt_id, v_server_now);
        RAISE EXCEPTION 'ATTEMPT_EXPIRED' USING ERRCODE = 'P0001';
    END IF;
    IF v_attempt.status <> 'in_progress' THEN
        RAISE EXCEPTION 'ATTEMPT_NOT_ACTIVE' USING ERRCODE = 'P0001';
    END IF;

    -- Validate every item before the single upsert. This keeps the batch
    -- atomic and avoids accepting a partial answer set.
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_answers) AS item(value) LOOP
        IF jsonb_typeof(v_item) <> 'object'
           OR NOT (v_item ? 'questionId')
           OR NOT (v_item ? 'selectedAnswer')
           OR NOT (v_item ? 'isFlagged')
           OR NOT (v_item ? 'answeredAt')
           OR NOT (v_item ? 'timeSpentSeconds')
           OR NOT (v_item ? 'clientMutationId') THEN
            RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
        END IF;
        IF (v_item ->> 'questionId') IS NULL
           OR (v_item ->> 'clientMutationId') IS NULL
           OR (v_item ->> 'questionId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
           OR (v_item ->> 'clientMutationId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
            RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
        END IF;
        v_question_id := (v_item ->> 'questionId')::UUID;
        IF v_question_id = ANY(v_seen_questions) THEN
            RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
        END IF;
        v_seen_questions := array_append(v_seen_questions, v_question_id);
        IF NOT EXISTS (
            SELECT 1
            FROM public.toeic_attempt_questions AS snapshot
            WHERE snapshot.attempt_id = p_attempt_id
              AND snapshot.question_id = v_question_id
        ) THEN
            RAISE EXCEPTION 'QUESTION_NOT_IN_ATTEMPT' USING ERRCODE = 'P0001';
        END IF;

        v_selected_answer := v_item ->> 'selectedAnswer';
        IF v_selected_answer IS NOT NULL
           AND v_selected_answer NOT IN ('A', 'B', 'C', 'D') THEN
            RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
        END IF;
        IF jsonb_typeof(v_item -> 'isFlagged') <> 'boolean' THEN
            RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
        END IF;
        IF jsonb_typeof(v_item -> 'timeSpentSeconds') = 'null' THEN
            NULL;
        ELSIF (v_item ->> 'timeSpentSeconds') !~ '^[0-9]+$' THEN
            RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
        ELSIF length(v_item ->> 'timeSpentSeconds') > 9 THEN
            RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
        END IF;
        IF jsonb_typeof(v_item -> 'answeredAt') = 'null' THEN
            NULL;
        ELSE
            BEGIN
                PERFORM (v_item ->> 'answeredAt')::TIMESTAMPTZ;
            EXCEPTION WHEN OTHERS THEN
                RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
            END;
        END IF;
    END LOOP;

    WITH parsed AS (
        SELECT
            (item.value ->> 'questionId')::UUID AS question_id,
            item.value ->> 'selectedAnswer' AS selected_answer,
            (item.value ->> 'isFlagged')::BOOLEAN AS is_flagged,
            CASE
                WHEN jsonb_typeof(item.value -> 'answeredAt') = 'null' THEN NULL
                ELSE (item.value ->> 'answeredAt')::TIMESTAMPTZ
            END AS answered_at,
            CASE
                WHEN jsonb_typeof(item.value -> 'timeSpentSeconds') = 'null' THEN NULL
                ELSE (item.value ->> 'timeSpentSeconds')::INTEGER
            END AS time_spent_seconds
        FROM jsonb_array_elements(p_answers) AS item(value)
    ), saved AS (
        INSERT INTO public.toeic_test_answers (
            attempt_id,
            question_id,
            selected_answer,
            is_flagged,
            answered_at,
            time_spent_seconds
        )
        SELECT
            p_attempt_id,
            parsed.question_id,
            parsed.selected_answer,
            parsed.is_flagged,
            parsed.answered_at,
            parsed.time_spent_seconds
        FROM parsed
        ON CONFLICT (attempt_id, question_id) DO UPDATE
        SET selected_answer = EXCLUDED.selected_answer,
            is_flagged = EXCLUDED.is_flagged,
            answered_at = EXCLUDED.answered_at,
            time_spent_seconds = EXCLUDED.time_spent_seconds
        RETURNING question_id, selected_answer, is_flagged, answered_at,
            time_spent_seconds, updated_at
    )
    SELECT jsonb_build_object(
        'attemptId', p_attempt_id,
        'saved', COALESCE(jsonb_agg(
            jsonb_build_object(
                'questionId', saved.question_id,
                'selectedAnswer', saved.selected_answer,
                'isFlagged', saved.is_flagged,
                'answeredAt', saved.answered_at,
                'timeSpentSeconds', saved.time_spent_seconds,
                'updatedAt', saved.updated_at
            )
            ORDER BY saved.question_id ASC
        ), '[]'::JSONB),
        'serverNow', clock_timestamp()
    )
    INTO v_saved_result
    FROM saved;

    INSERT INTO public.toeic_attempt_mutations (
        user_id,
        attempt_id,
        mutation_key,
        mutation_type,
        result
    )
    VALUES (
        v_user_id,
        p_attempt_id,
        p_mutation_key,
        'save_answers',
        v_saved_result
    );

    RETURN v_saved_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_toeic_attempt_session(
    p_attempt_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_attempt RECORD;
    v_server_now TIMESTAMPTZ := clock_timestamp();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = 'P0001';
    END IF;
    IF p_attempt_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
    END IF;

    SELECT attempt.id, attempt.user_id, attempt.status, attempt.deadline_at
    INTO v_attempt
    FROM public.toeic_test_attempts AS attempt
    WHERE attempt.id = p_attempt_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ATTEMPT_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    IF v_attempt.user_id <> v_user_id THEN
        RAISE EXCEPTION 'ATTEMPT_NOT_OWNED' USING ERRCODE = 'P0001';
    END IF;

    IF v_attempt.status = 'in_progress'
       AND v_attempt.deadline_at IS NOT NULL
       AND v_attempt.deadline_at <= v_server_now THEN
        PERFORM public.expire_toeic_attempt_if_due(p_attempt_id, v_server_now);
    END IF;

    RETURN public.toeic_attempt_session_json(p_attempt_id, clock_timestamp());
END;
$$;

CREATE OR REPLACE FUNCTION public.abandon_toeic_attempt(
    p_attempt_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_attempt RECORD;
    v_server_now TIMESTAMPTZ := clock_timestamp();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = 'P0001';
    END IF;
    IF p_attempt_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
    END IF;

    SELECT attempt.id, attempt.user_id, attempt.status, attempt.deadline_at
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

    IF v_attempt.status = 'abandoned' THEN
        RETURN public.toeic_attempt_session_json(p_attempt_id, clock_timestamp());
    END IF;
    IF v_attempt.status = 'expired' THEN
        RETURN public.toeic_attempt_session_json(p_attempt_id, clock_timestamp());
    END IF;
    IF v_attempt.status <> 'in_progress' THEN
        RAISE EXCEPTION 'ATTEMPT_NOT_ACTIVE' USING ERRCODE = 'P0001';
    END IF;

    IF v_attempt.deadline_at IS NOT NULL AND v_attempt.deadline_at <= v_server_now THEN
        PERFORM public.expire_toeic_attempt_if_due(p_attempt_id, v_server_now);
    ELSE
        UPDATE public.toeic_test_attempts
        SET status = 'abandoned',
            updated_at = clock_timestamp()
        WHERE id = p_attempt_id;
    END IF;

    RETURN public.toeic_attempt_session_json(p_attempt_id, clock_timestamp());
END;
$$;

REVOKE ALL ON FUNCTION public.toeic_attempt_session_json(UUID, TIMESTAMPTZ)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_toeic_attempt_if_due(UUID, TIMESTAMPTZ)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.start_toeic_attempt(UUID, TEXT, SMALLINT[], UUID)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_toeic_attempt_answers(UUID, JSONB, UUID)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_toeic_attempt_session(UUID)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.abandon_toeic_attempt(UUID)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.start_toeic_attempt(UUID, TEXT, SMALLINT[], UUID)
TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_toeic_attempt_answers(UUID, JSONB, UUID)
TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_toeic_attempt_session(UUID)
TO authenticated;
GRANT EXECUTE ON FUNCTION public.abandon_toeic_attempt(UUID)
TO authenticated;

COMMENT ON COLUMN public.toeic_test_attempts.start_idempotency_key
IS 'Client-generated key for the logical start-attempt action; never reused for submission.';

COMMENT ON TABLE public.toeic_attempt_mutations
IS 'Server-owned idempotency ledger for batch attempt mutations; browser roles have no table privileges.';

COMMENT ON FUNCTION public.start_toeic_attempt(UUID, TEXT, SMALLINT[], UUID)
IS 'Creates or reuses an owner attempt and server-selected question snapshot.';

COMMENT ON FUNCTION public.save_toeic_attempt_answers(UUID, JSONB, UUID)
IS 'Atomically upserts owner answer state with a server-owned idempotency result.';

COMMENT ON FUNCTION public.get_toeic_attempt_session(UUID)
IS 'Returns an owner-only attempt snapshot and safe answer state without content or answer keys.';

COMMENT ON FUNCTION public.abandon_toeic_attempt(UUID)
IS 'Transitions an owner in-progress attempt to abandoned without deleting history.';
