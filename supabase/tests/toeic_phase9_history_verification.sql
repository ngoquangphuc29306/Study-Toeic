-- TOEIC Phase 9 history/progress/wrong-retry security verification.
-- Run after `supabase db reset` against the local database.

BEGIN;

DO $$
DECLARE
    history_function REGPROCEDURE := 'public.list_toeic_attempt_history(uuid,text,text,integer,integer)'::REGPROCEDURE;
    progress_function REGPROCEDURE := 'public.get_toeic_test_progress(uuid[])'::REGPROCEDURE;
    visibility_function REGPROCEDURE := 'public.set_toeic_test_progress_visibility(uuid,boolean)'::REGPROCEDURE;
    retry_function REGPROCEDURE := 'public.start_toeic_wrong_question_attempt(uuid,uuid)'::REGPROCEDURE;
    history_definition TEXT;
    progress_definition TEXT;
    retry_definition TEXT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = history_function)
       OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = progress_function)
       OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = visibility_function)
       OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = retry_function) THEN
        RAISE EXCEPTION 'Phase 9 RPC is missing';
    END IF;

    IF has_function_privilege('anon', history_function, 'EXECUTE')
       OR has_function_privilege('anon', progress_function, 'EXECUTE')
       OR has_function_privilege('anon', visibility_function, 'EXECUTE')
       OR has_function_privilege('anon', retry_function, 'EXECUTE')
       OR NOT has_function_privilege('authenticated', history_function, 'EXECUTE')
       OR NOT has_function_privilege('authenticated', progress_function, 'EXECUTE')
       OR NOT has_function_privilege('authenticated', visibility_function, 'EXECUTE')
       OR NOT has_function_privilege('authenticated', retry_function, 'EXECUTE') THEN
        RAISE EXCEPTION 'Phase 9 RPC grants are incorrect';
    END IF;

    SELECT pg_get_functiondef(history_function) INTO history_definition;
    SELECT pg_get_functiondef(progress_function) INTO progress_definition;
    SELECT pg_get_functiondef(retry_function) INTO retry_definition;
    IF history_definition ILIKE '%toeic_question_answer_keys%'
       OR progress_definition ILIKE '%toeic_question_answer_keys%'
       OR retry_definition ILIKE '%correct_answer%' THEN
        RAISE EXCEPTION 'Phase 9 browser projections must not read or return answer keys';
    END IF;
    IF retry_definition NOT ILIKE '%answer.is_correct IS FALSE%'
       OR retry_definition ILIKE '%p_question_ids%' THEN
        RAISE EXCEPTION 'Wrong retry must be server-selected from incorrect answers';
    END IF;
END;
$$;

DO $$
BEGIN
    IF has_table_privilege('authenticated', 'public.toeic_test_progress_preferences', 'SELECT')
       OR has_table_privilege('authenticated', 'public.toeic_test_progress_preferences', 'INSERT')
       OR has_table_privilege('authenticated', 'public.toeic_test_progress_preferences', 'UPDATE')
       OR has_table_privilege('authenticated', 'public.toeic_test_progress_preferences', 'DELETE') THEN
        RAISE EXCEPTION 'Progress preference table must remain behind its RPC boundary';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_class
        WHERE oid = 'public.toeic_test_progress_preferences'::regclass
          AND relrowsecurity
          AND relforcerowsecurity
    ) THEN
        RAISE EXCEPTION 'Progress preference RLS is not forced';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_attribute
        WHERE attrelid = 'public.toeic_test_attempts'::regclass
          AND attname = 'wrong_retry_source_attempt_id'
          AND NOT attisdropped
    ) THEN
        RAISE EXCEPTION 'Wrong retry source provenance column is missing';
    END IF;
END;
$$;

DO $$
DECLARE
    result_constraint TEXT;
BEGIN
    SELECT pg_get_constraintdef(oid)
    INTO result_constraint
    FROM pg_constraint
    WHERE conrelid = 'public.toeic_test_progress_preferences'::regclass
      AND contype = 'p';
    IF result_constraint IS NULL OR result_constraint NOT ILIKE '%user_id%' OR result_constraint NOT ILIKE '%test_id%' THEN
        RAISE EXCEPTION 'Progress preference must be unique per user and test';
    END IF;
END;
$$;

ROLLBACK;

-- Data-level JWT verification remains required:
-- 1. User A cannot read User B history/progress or retry User B's submitted attempt.
-- 2. History uses stored submission_result and never rescored answers.
-- 3. Hidden progress preserves attempts/results and restore makes it visible again.
-- 4. Wrong retry rejects non-submitted/all-correct sources and never accepts question IDs.
-- 5. Retry with the same key returns the same new attempt and cannot duplicate snapshots.
-- 6. Retry snapshot preserves source order and contains only is_correct = false rows.
-- 7. Scaled score remains null and no calculator/approximation is introduced.
