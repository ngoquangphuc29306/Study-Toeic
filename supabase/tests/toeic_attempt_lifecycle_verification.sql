-- TOEIC Phase 5 attempt lifecycle verification
-- Run after `supabase db reset` against the local database.
-- This metadata/privilege verification does not create test users or attempts.

BEGIN;

DO $$
DECLARE
    required_table TEXT;
BEGIN
    FOREACH required_table IN ARRAY ARRAY[
        'public.toeic_test_attempts',
        'public.toeic_attempt_questions',
        'public.toeic_test_answers',
        'public.toeic_attempt_mutations'
    ] LOOP
        IF to_regclass(required_table) IS NULL THEN
            RAISE EXCEPTION 'Missing Phase 5 table: %', required_table;
        END IF;
    END LOOP;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'toeic_test_attempts'
          AND column_name = 'start_idempotency_key'
          AND data_type = 'uuid'
    ) THEN
        RAISE EXCEPTION 'start_idempotency_key is missing';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'idx_toeic_attempts_user_start_idempotency'
    ) THEN
        RAISE EXCEPTION 'Start idempotency index is missing';
    END IF;
    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'idx_toeic_active_exam_per_user_test'
    ) OR NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'idx_toeic_active_practice_per_selection'
    ) THEN
        RAISE EXCEPTION 'Active attempt uniqueness indexes are missing';
    END IF;
END;
$$;

DO $$
BEGIN
    IF has_table_privilege('authenticated', 'public.toeic_test_attempts', 'SELECT')
       OR has_table_privilege('authenticated', 'public.toeic_attempt_questions', 'SELECT')
       OR has_table_privilege('authenticated', 'public.toeic_test_answers', 'SELECT') THEN
        RAISE EXCEPTION 'Browser can bypass the safe attempt session projection';
    END IF;
    IF has_table_privilege('authenticated', 'public.toeic_test_attempts', 'INSERT')
       OR has_table_privilege('authenticated', 'public.toeic_test_attempts', 'UPDATE')
       OR has_table_privilege('authenticated', 'public.toeic_attempt_questions', 'INSERT')
       OR has_table_privilege('authenticated', 'public.toeic_test_answers', 'INSERT')
       OR has_table_privilege('authenticated', 'public.toeic_test_answers', 'UPDATE') THEN
        RAISE EXCEPTION 'Browser has direct attempt mutation privilege';
    END IF;
    IF has_table_privilege('authenticated', 'public.toeic_attempt_mutations', 'SELECT')
       OR has_table_privilege('authenticated', 'public.toeic_attempt_mutations', 'INSERT')
       OR has_table_privilege('authenticated', 'public.toeic_attempt_mutations', 'UPDATE') THEN
        RAISE EXCEPTION 'Browser can access the idempotency ledger';
    END IF;
END;
$$;

DO $$
DECLARE
    start_function REGPROCEDURE := 'public.start_toeic_attempt(uuid,text,smallint[],uuid)'::REGPROCEDURE;
    save_function REGPROCEDURE := 'public.save_toeic_attempt_answers(uuid,jsonb,uuid)'::REGPROCEDURE;
    session_function REGPROCEDURE := 'public.get_toeic_attempt_session(uuid)'::REGPROCEDURE;
    abandon_function REGPROCEDURE := 'public.abandon_toeic_attempt(uuid)'::REGPROCEDURE;
BEGIN
    IF NOT has_function_privilege('authenticated', start_function, 'EXECUTE')
       OR NOT has_function_privilege('authenticated', save_function, 'EXECUTE')
       OR NOT has_function_privilege('authenticated', session_function, 'EXECUTE')
       OR NOT has_function_privilege('authenticated', abandon_function, 'EXECUTE') THEN
        RAISE EXCEPTION 'Authenticated attempt RPC grants are missing';
    END IF;
    IF has_function_privilege('anon', start_function, 'EXECUTE')
       OR has_function_privilege('anon', save_function, 'EXECUTE')
       OR has_function_privilege('anon', session_function, 'EXECUTE')
       OR has_function_privilege('anon', abandon_function, 'EXECUTE') THEN
        RAISE EXCEPTION 'Anonymous role can execute an attempt RPC';
    END IF;
END;
$$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('toeic_test_attempts', 'toeic_attempt_questions', 'toeic_test_answers', 'toeic_attempt_mutations')
          AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
    ) THEN
        RAISE EXCEPTION 'Browser mutation policy unexpectedly exists';
    END IF;
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'toeic_test_attempts'
          AND policyname = 'toeic_attempts_select_own'
          AND cmd = 'SELECT'
    ) THEN
        RAISE EXCEPTION 'Owner attempt RLS policy is missing';
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.toeic_test_attempts'::regclass
          AND conname = 'toeic_attempt_exam_deadline_check'
    ) OR NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.toeic_test_answers'::regclass
          AND conname = 'toeic_test_answers_attempt_question_fk'
    ) THEN
        RAISE EXCEPTION 'Attempt deadline or answer membership constraint is missing';
    END IF;
END;
$$;

ROLLBACK;

-- Manual JWT/integration verification is required for data behavior:
-- 1. Unauthenticated start/save/resume/abandon calls are rejected.
-- 2. Exam start selects all seven parts, sets server deadline, and snapshots
--    exactly the server-selected questions in deterministic order.
-- 3. Practice start snapshots only selected parts.
-- 4. Reusing a start key returns the same attempt; it never duplicates rows.
-- 5. Reusing a save mutation key returns the original result without a second
--    write.
-- 6. Wrong owner, invalid question, invalid option, duplicate question,
--    is_correct input and >50 answers are rejected atomically.
-- 7. Expired exam attempts become expired and reject new autosaves.
-- 8. Abandon preserves attempt questions and answers; repeat abandon is safe.
-- 9. Session JSON contains no answer key, isCorrect, explanation,
--    transcript, translation or vocabulary content.
