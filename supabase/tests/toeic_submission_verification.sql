DO $$
DECLARE
    submit_function REGPROCEDURE := 'public.submit_toeic_attempt(uuid,uuid)'::REGPROCEDURE;
    result_function REGPROCEDURE := 'public.get_toeic_attempt_result(uuid)'::REGPROCEDURE;
    review_function REGPROCEDURE := 'public.get_toeic_attempt_review(uuid)'::REGPROCEDURE;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = submit_function)
       OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = result_function)
       OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = review_function) THEN
        RAISE EXCEPTION 'Phase 7 submission/result/review RPC is missing';
    END IF;

    IF has_function_privilege('anon', submit_function, 'EXECUTE')
       OR has_function_privilege('anon', result_function, 'EXECUTE')
       OR has_function_privilege('anon', review_function, 'EXECUTE')
       OR NOT has_function_privilege('authenticated', submit_function, 'EXECUTE')
       OR NOT has_function_privilege('authenticated', result_function, 'EXECUTE')
       OR NOT has_function_privilege('authenticated', review_function, 'EXECUTE') THEN
        RAISE EXCEPTION 'Phase 7 RPC grants are incorrect';
    END IF;

    IF has_table_privilege('authenticated', 'public.toeic_question_answer_keys', 'SELECT')
       OR has_table_privilege('authenticated', 'public.toeic_test_answers', 'UPDATE')
       OR has_table_privilege('authenticated', 'public.toeic_test_answers', 'INSERT')
       OR has_table_privilege('authenticated', 'public.toeic_test_answers', 'DELETE') THEN
        RAISE EXCEPTION 'Answer key or answer mutation leaked to browser role';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_class
        WHERE oid = 'public.toeic_question_answer_keys'::regclass
          AND relrowsecurity
          AND relforcerowsecurity
    ) THEN
        RAISE EXCEPTION 'Answer-key RLS is not forced';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.toeic_test_attempts'::regclass
          AND conname = 'toeic_attempt_user_submit_key_unique'
    ) THEN
        RAISE EXCEPTION 'Submit idempotency uniqueness constraint is missing';
    END IF;

    RAISE NOTICE 'Phase 7 submission security verification passed';
END;
$$;
