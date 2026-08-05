-- TOEIC Phase 2 catalog/security verification
-- Run after `supabase db reset` against the local database.
-- This script checks schema metadata and privileges without inserting data.
-- JWT-level User A/User B RLS tests require an authenticated PostgREST session
-- and are listed in the manual verification notes at the end.

BEGIN;

DO $$
DECLARE
    required_table TEXT;
BEGIN
    FOREACH required_table IN ARRAY ARRAY[
        'public.toeic_tests',
        'public.toeic_passages',
        'public.toeic_questions',
        'public.toeic_question_answer_keys',
        'public.toeic_test_attempts',
        'public.toeic_attempt_questions',
        'public.toeic_test_answers'
    ] LOOP
        IF to_regclass(required_table) IS NULL THEN
            RAISE EXCEPTION 'Missing required TOEIC table: %', required_table;
        END IF;
    END LOOP;
END;
$$;

DO $$
DECLARE
    table_name TEXT;
    table_oid OID;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'toeic_tests',
        'toeic_passages',
        'toeic_questions',
        'toeic_question_answer_keys',
        'toeic_test_attempts',
        'toeic_attempt_questions',
        'toeic_test_answers'
    ] LOOP
        SELECT c.oid
        INTO table_oid
        FROM pg_class AS c
        JOIN pg_namespace AS n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = table_name;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_class AS c
            WHERE c.oid = table_oid
              AND c.relrowsecurity
              AND c.relforcerowsecurity
        ) THEN
            RAISE EXCEPTION 'RLS is not enabled and forced for public.%', table_name;
        END IF;
    END LOOP;
END;
$$;

DO $$
BEGIN
    IF NOT has_table_privilege('authenticated', 'public.toeic_tests', 'SELECT')
       OR NOT has_table_privilege('authenticated', 'public.toeic_passages', 'SELECT')
       OR NOT has_table_privilege('authenticated', 'public.toeic_questions', 'SELECT') THEN
        RAISE EXCEPTION 'Authenticated SELECT grants are missing for client-safe content';
    END IF;

    IF has_table_privilege('authenticated', 'public.toeic_question_answer_keys', 'SELECT')
       OR has_table_privilege('anon', 'public.toeic_question_answer_keys', 'SELECT') THEN
        RAISE EXCEPTION 'Answer key is readable by a browser role';
    END IF;

    IF has_table_privilege('authenticated', 'public.toeic_questions', 'INSERT')
       OR has_table_privilege('authenticated', 'public.toeic_test_attempts', 'INSERT')
       OR has_table_privilege('authenticated', 'public.toeic_test_answers', 'UPDATE') THEN
        RAISE EXCEPTION 'Browser mutation privilege is broader than the Phase 2 boundary';
    END IF;
END;
$$;

DO $$
DECLARE
    import_function REGPROCEDURE := 'public.import_toeic_test(jsonb,jsonb,jsonb,jsonb,boolean)'::REGPROCEDURE;
BEGIN
    IF NOT has_function_privilege('service_role', import_function, 'EXECUTE') THEN
        RAISE EXCEPTION 'Service role cannot execute the server-only TOEIC import RPC';
    END IF;
    IF has_function_privilege('authenticated', import_function, 'EXECUTE')
       OR has_function_privilege('anon', import_function, 'EXECUTE') THEN
        RAISE EXCEPTION 'Browser role can execute the server-only TOEIC import RPC';
    END IF;
END;
$$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'toeic_question_answer_keys'
          AND cmd = 'SELECT'
    ) THEN
        RAISE EXCEPTION 'Answer key unexpectedly has a SELECT policy';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'toeic_tests'
          AND policyname = 'toeic_tests_select_published'
          AND cmd = 'SELECT'
    ) THEN
        RAISE EXCEPTION 'Published-test SELECT policy is missing';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'toeic_test_attempts'
          AND policyname = 'toeic_attempts_select_own'
          AND cmd = 'SELECT'
    ) THEN
        RAISE EXCEPTION 'Own-attempt SELECT policy is missing';
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.toeic_questions'::regclass
          AND conname = 'toeic_questions_passage_same_test_fk'
    ) THEN
        RAISE EXCEPTION 'Question/passage same-test composite FK is missing';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.toeic_attempt_questions'::regclass
          AND conname = 'toeic_attempt_questions_question_test_part_fk'
    ) THEN
        RAISE EXCEPTION 'Attempt/question same-test/part composite FK is missing';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.toeic_test_answers'::regclass
          AND conname = 'toeic_test_answers_attempt_question_fk'
    ) THEN
        RAISE EXCEPTION 'Answer membership FK is missing';
    END IF;
END;
$$;

ROLLBACK;

-- Manual JWT/PostgREST verification still required when local Supabase is running:
-- 1. Anonymous: cannot SELECT tests, passages, questions or answer keys.
-- 2. Authenticated User A: can SELECT published content, not draft/archived.
-- 3. User A cannot SELECT User B's attempts or answers.
-- 4. User A cannot insert/update attempts, attempt snapshots or answers directly.
-- 5. User A cannot read answer keys or write is_correct.
-- 6. A passage/question from another test fails the composite FK.
-- 7. selected_parts with duplicates/out-of-range values fails its CHECK helper.
