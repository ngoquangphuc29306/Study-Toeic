-- =====================================================================
-- VOCABTOEIC - TOEIC SERVER-SIDE IMPORT RPC
-- Migration Version: 20260805_100000
-- Scope: Atomic draft content import for the Phase 3 importer
-- =====================================================================

CREATE OR REPLACE FUNCTION public.import_toeic_test(
    p_test JSONB,
    p_passages JSONB,
    p_questions JSONB,
    p_answer_keys JSONB,
    p_replace_draft BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_test_id UUID;
    v_existing_status TEXT;
    v_replaced_draft BOOLEAN := FALSE;
    v_expected_questions INTEGER;
    v_passage_count INTEGER;
    v_question_count INTEGER;
    v_answer_key_count INTEGER;
BEGIN
    IF jsonb_typeof(p_test) <> 'object'
       OR jsonb_typeof(p_passages) <> 'array'
       OR jsonb_typeof(p_questions) <> 'array'
       OR jsonb_typeof(p_answer_keys) <> 'array' THEN
        RAISE EXCEPTION 'TOEIC import payload must contain one test object and three arrays';
    END IF;

    IF p_test->>'status' IS DISTINCT FROM 'draft' THEN
        RAISE EXCEPTION 'TOEIC imports must remain draft';
    END IF;

    v_test_id := (p_test->>'id')::UUID;
    v_expected_questions := (p_test->>'total_questions')::INTEGER;

    SELECT status
    INTO v_existing_status
    FROM public.toeic_tests
    WHERE id = v_test_id
    FOR UPDATE;

    IF FOUND THEN
        IF v_existing_status IN ('published', 'archived') THEN
            RAISE EXCEPTION 'Published or archived TOEIC tests cannot be overwritten';
        END IF;

        IF NOT p_replace_draft THEN
            RAISE EXCEPTION 'Draft TOEIC test already exists; pass replace-draft explicitly';
        END IF;

        IF EXISTS (
            SELECT 1
            FROM public.toeic_test_attempts
            WHERE test_id = v_test_id
        ) THEN
            RAISE EXCEPTION 'TOEIC test cannot be replaced after an attempt exists';
        END IF;

        DELETE FROM public.toeic_tests
        WHERE id = v_test_id;
        v_replaced_draft := TRUE;
    END IF;

    INSERT INTO public.toeic_tests (
        id,
        name,
        set_name,
        year,
        source,
        description,
        is_free,
        status,
        media_folder,
        total_questions,
        duration_seconds
    )
    SELECT id, name, set_name, year, source, description, is_free, status,
           media_folder, total_questions, duration_seconds
    FROM jsonb_to_record(p_test) AS test_row(
        id UUID,
        name TEXT,
        set_name TEXT,
        year INTEGER,
        source TEXT,
        description TEXT,
        is_free BOOLEAN,
        status TEXT,
        media_folder TEXT,
        total_questions INTEGER,
        duration_seconds INTEGER
    );

    INSERT INTO public.toeic_passages (
        id,
        test_id,
        part,
        passage_type,
        title,
        content,
        transcript,
        translation,
        audio_path,
        image_path,
        position
    )
    SELECT id, test_id, part, passage_type, title, content, transcript,
           translation, audio_path, image_path, position
    FROM jsonb_to_recordset(p_passages) AS passage_row(
        id UUID,
        test_id UUID,
        part SMALLINT,
        passage_type TEXT,
        title TEXT,
        content JSONB,
        transcript TEXT,
        translation TEXT,
        audio_path TEXT,
        image_path TEXT,
        position INTEGER
    );

    INSERT INTO public.toeic_questions (
        id,
        test_id,
        passage_id,
        part,
        section,
        question_number,
        question_text,
        options,
        explanation_en,
        explanation_vi,
        ai_explanation,
        vocabulary_content,
        audio_path,
        image_path,
        position
    )
    SELECT id, test_id, passage_id, part, section, question_number,
           question_text, options, explanation_en, explanation_vi,
           ai_explanation, vocabulary_content, audio_path, image_path, position
    FROM jsonb_to_recordset(p_questions) AS question_row(
        id UUID,
        test_id UUID,
        passage_id UUID,
        part SMALLINT,
        section TEXT,
        question_number INTEGER,
        question_text TEXT,
        options JSONB,
        explanation_en TEXT,
        explanation_vi TEXT,
        ai_explanation TEXT,
        vocabulary_content JSONB,
        audio_path TEXT,
        image_path TEXT,
        position INTEGER
    );

    INSERT INTO public.toeic_question_answer_keys (question_id, correct_answer)
    SELECT question_id, correct_answer
    FROM jsonb_to_recordset(p_answer_keys) AS answer_key_row(
        question_id UUID,
        correct_answer TEXT
    );

    SELECT count(*)::INTEGER INTO v_passage_count
    FROM public.toeic_passages
    WHERE test_id = v_test_id;

    SELECT count(*)::INTEGER INTO v_question_count
    FROM public.toeic_questions
    WHERE test_id = v_test_id;

    SELECT count(*)::INTEGER INTO v_answer_key_count
    FROM public.toeic_question_answer_keys AS answer_key
    JOIN public.toeic_questions AS question
      ON question.id = answer_key.question_id
    WHERE question.test_id = v_test_id;

    IF v_question_count <> v_expected_questions
       OR v_answer_key_count <> v_question_count
       OR v_passage_count <> jsonb_array_length(p_passages) THEN
        RAISE EXCEPTION 'TOEIC import count verification failed: passages %, questions %, answer keys %, expected questions %',
            v_passage_count, v_question_count, v_answer_key_count, v_expected_questions;
    END IF;

    RETURN jsonb_build_object(
        'status', 'success',
        'test_id', v_test_id,
        'replaced_draft', v_replaced_draft,
        'counts', jsonb_build_object(
            'passages', v_passage_count,
            'questions', v_question_count,
            'answer_keys', v_answer_key_count
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.import_toeic_test(JSONB, JSONB, JSONB, JSONB, BOOLEAN)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.import_toeic_test(JSONB, JSONB, JSONB, JSONB, BOOLEAN)
TO service_role;

COMMENT ON FUNCTION public.import_toeic_test(JSONB, JSONB, JSONB, JSONB, BOOLEAN)
IS 'Server-only atomic TOEIC draft import. Accepts normalized content, preserves source UUIDs, refuses published/attempted replacements, verifies row counts, and never publishes a test.';
