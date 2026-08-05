CREATE OR REPLACE FUNCTION public.get_active_toeic_attempt(
    p_test_id UUID,
    p_mode TEXT,
    p_selected_parts SMALLINT[]
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
    IF p_test_id IS NULL OR p_mode NOT IN ('exam', 'practice')
       OR p_selected_parts IS NULL OR cardinality(p_selected_parts) = 0 THEN
        RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
    END IF;

    SELECT attempt.id, attempt.deadline_at
    INTO v_attempt
    FROM public.toeic_test_attempts AS attempt
    WHERE attempt.user_id = v_user_id
      AND attempt.test_id = p_test_id
      AND attempt.mode = p_mode
      AND attempt.selected_parts = p_selected_parts
      AND attempt.status = 'in_progress'
    ORDER BY attempt.started_at DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ATTEMPT_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;

    IF v_attempt.deadline_at IS NOT NULL AND v_attempt.deadline_at <= v_server_now THEN
        PERFORM public.expire_toeic_attempt_if_due(v_attempt.id, v_server_now);
        RAISE EXCEPTION 'ATTEMPT_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;

    RETURN public.toeic_attempt_session_json(v_attempt.id, clock_timestamp());
END;
$$;

REVOKE ALL ON FUNCTION public.get_active_toeic_attempt(UUID, TEXT, SMALLINT[])
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_active_toeic_attempt(UUID, TEXT, SMALLINT[])
TO authenticated;

COMMENT ON FUNCTION public.get_active_toeic_attempt(UUID, TEXT, SMALLINT[])
IS 'Returns the owner active attempt for the exact test, mode, and selected-part set.';
