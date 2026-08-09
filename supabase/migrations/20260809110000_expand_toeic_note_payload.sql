-- Phase 11.6A: rich note documents are stored as compact JSON in the existing
-- server-authoritative content column. The visible note text remains capped at
-- 5,000 characters; this payload limit leaves room for formatting metadata.
ALTER TABLE public.toeic_test_notes
    DROP CONSTRAINT toeic_test_notes_content_check,
    ADD CONSTRAINT toeic_test_notes_content_check
        CHECK (char_length(btrim(content)) BETWEEN 1 AND 20000);

CREATE OR REPLACE FUNCTION public.upsert_toeic_note(
    p_test_id UUID,
    p_question_id UUID,
    p_content TEXT
) RETURNS JSONB
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_note public.toeic_test_notes%ROWTYPE;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = 'P0001';
    END IF;
    IF p_test_id IS NULL OR char_length(btrim(COALESCE(p_content, ''))) NOT BETWEEN 1 AND 20000 THEN
        RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
    END IF;
    IF NOT public.is_toeic_test_published(p_test_id) THEN
        RAISE EXCEPTION 'TEST_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    IF p_question_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.toeic_questions q WHERE q.id = p_question_id AND q.test_id = p_test_id
    ) THEN
        RAISE EXCEPTION 'TARGET_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    SELECT * INTO v_note
    FROM public.toeic_test_notes n
    WHERE n.user_id = v_user_id
      AND n.test_id = p_test_id
      AND ((p_question_id IS NULL AND n.question_id IS NULL) OR n.question_id = p_question_id);
    IF v_note.id IS NULL THEN
        INSERT INTO public.toeic_test_notes(user_id, test_id, question_id, content)
        VALUES (v_user_id, p_test_id, p_question_id, btrim(p_content))
        RETURNING * INTO v_note;
    ELSE
        UPDATE public.toeic_test_notes
        SET content = btrim(p_content), updated_at = clock_timestamp()
        WHERE id = v_note.id
        RETURNING * INTO v_note;
    END IF;
    RETURN jsonb_build_object(
        'id', v_note.id,
        'testId', v_note.test_id,
        'questionId', v_note.question_id,
        'content', v_note.content,
        'createdAt', v_note.created_at,
        'updatedAt', v_note.updated_at
    );
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_toeic_note(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_toeic_note(UUID, UUID, TEXT) TO authenticated;
