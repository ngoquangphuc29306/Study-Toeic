-- TOEIC Phase 8 learning-content security verification.
-- Run after `supabase db reset` against the local database.

BEGIN;

DO $$
DECLARE
    practice_function REGPROCEDURE := 'public.check_toeic_practice_answer(uuid,uuid)'::REGPROCEDURE;
    review_learning_function REGPROCEDURE := 'public.get_toeic_attempt_review_content(uuid)'::REGPROCEDURE;
    practice_definition TEXT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = practice_function)
       OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = review_learning_function) THEN
        RAISE EXCEPTION 'Phase 8 learning RPC is missing';
    END IF;

    IF has_function_privilege('anon', practice_function, 'EXECUTE')
       OR has_function_privilege('anon', review_learning_function, 'EXECUTE')
       OR NOT has_function_privilege('authenticated', practice_function, 'EXECUTE')
       OR NOT has_function_privilege('authenticated', review_learning_function, 'EXECUTE') THEN
        RAISE EXCEPTION 'Phase 8 learning RPC grants are incorrect';
    END IF;

    SELECT pg_get_functiondef(practice_function) INTO practice_definition;
    IF practice_definition ILIKE '%UPDATE public.toeic_test_answers%'
       OR practice_definition ILIKE '%INSERT INTO public.toeic_test_answers%' THEN
        RAISE EXCEPTION 'Practice feedback RPC must not write answer correctness';
    END IF;
END;
$$;

DO $$
BEGIN
    IF has_table_privilege('authenticated', 'public.toeic_question_answer_keys', 'SELECT')
       OR has_table_privilege('authenticated', 'public.toeic_test_answers', 'SELECT')
       OR has_table_privilege('authenticated', 'public.toeic_test_answers', 'INSERT')
       OR has_table_privilege('authenticated', 'public.toeic_test_answers', 'UPDATE')
       OR has_table_privilege('authenticated', 'public.toeic_attempt_questions', 'SELECT') THEN
        RAISE EXCEPTION 'Phase 8 sensitive TOEIC table access leaked to browser role';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_class
        WHERE oid = 'public.toeic_question_answer_keys'::regclass
          AND relrowsecurity
          AND relforcerowsecurity
    ) THEN
        RAISE EXCEPTION 'Answer-key RLS is not forced';
    END IF;
END;
$$;

DO $$
DECLARE
    safe_read_definition TEXT;
BEGIN
    SELECT pg_get_functiondef('public.get_published_toeic_test_part(uuid,smallint)'::REGPROCEDURE)
    INTO safe_read_definition;
    IF safe_read_definition ILIKE '%correct_answer%'
       OR safe_read_definition ILIKE '%transcript%'
       OR safe_read_definition ILIKE '%explanation_en%'
       OR safe_read_definition ILIKE '%vocabulary_content%' THEN
        RAISE EXCEPTION 'Safe test-taking read boundary exposes Phase 8 learning fields';
    END IF;
END;
$$;

ROLLBACK;

-- Data-level JWT verification remains required:
-- 1. Practice check rejects exam attempts, foreign owners, unsaved answers,
--    questions outside the snapshot, closed attempts and expired attempts.
-- 2. Review learning content rejects non-submitted and foreign attempts.
-- 3. Neither RPC can be used anonymously or through direct table reads.
-- 4. Practice responses contain only the checked question; review responses
--    contain only the submitted owner's snapshot and its referenced passages.
