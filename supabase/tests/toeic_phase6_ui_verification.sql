DO $$
DECLARE
    active_function REGPROCEDURE := 'public.get_active_toeic_attempt(uuid,text,smallint[])'::REGPROCEDURE;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE oid = active_function
    ) THEN
        RAISE EXCEPTION 'Phase 6 active attempt read RPC is missing';
    END IF;

    IF has_function_privilege('anon', active_function, 'EXECUTE')
       OR NOT has_function_privilege('authenticated', active_function, 'EXECUTE') THEN
        RAISE EXCEPTION 'Phase 6 active attempt read RPC grants are incorrect';
    END IF;

    IF has_table_privilege('authenticated', 'public.toeic_test_attempts', 'INSERT')
       OR has_table_privilege('authenticated', 'public.toeic_attempt_questions', 'INSERT')
       OR has_table_privilege('authenticated', 'public.toeic_test_answers', 'INSERT') THEN
        RAISE EXCEPTION 'Phase 6 must not grant browser direct mutation';
    END IF;

    RAISE NOTICE 'Phase 6 UI/read-boundary verification passed';
END;
$$;
