-- =====================================================================
-- TOEIC PHASE 4 - SAFE READ CONTRACTS AND PRIVATE MEDIA
--
-- Browser roles must never receive answer keys or post-answer content.
-- Read access is exposed through the two explicit RPC contracts below.
-- =====================================================================

-- Production media is private. No storage.objects policy is created for this
-- bucket; signed URLs are issued only by the server-only media boundary.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'toeic-test-media',
    'toeic-test-media',
    FALSE,
    52428800,
    ARRAY['audio/mpeg', 'image/webp', 'image/png', 'image/jpeg']::TEXT[]
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = FALSE,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Keep the existing RLS policies as defense in depth, but remove direct table
-- SELECT so a browser cannot bypass the explicit safe read projections.
REVOKE SELECT ON TABLE public.toeic_tests,
    public.toeic_passages,
    public.toeic_questions
FROM authenticated;

CREATE OR REPLACE FUNCTION public.list_published_toeic_tests(
    p_year INTEGER DEFAULT NULL,
    p_set_name TEXT DEFAULT NULL,
    p_source TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_limit INTEGER;
    v_offset INTEGER;
    v_set_name TEXT := NULLIF(btrim(p_set_name), '');
    v_source TEXT := NULLIF(btrim(p_source), '');
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'UNAUTHENTICATED';
    END IF;

    IF p_limit IS NULL THEN
        v_limit := 20;
    ELSIF p_limit BETWEEN 1 AND 50 THEN
        v_limit := p_limit;
    ELSE
        RAISE EXCEPTION 'INVALID_INPUT';
    END IF;

    IF p_offset IS NULL OR p_offset < 0 OR p_offset > 100000 THEN
        RAISE EXCEPTION 'INVALID_INPUT';
    END IF;
    v_offset := COALESCE(p_offset, 0);

    RETURN jsonb_build_object(
        'items', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', catalog.id,
                    'name', catalog.name,
                    'set_name', catalog.set_name,
                    'year', catalog.year,
                    'source', catalog.source,
                    'description', catalog.description,
                    'is_free', catalog.is_free,
                    'total_questions', catalog.total_questions,
                    'duration_seconds', catalog.duration_seconds
                )
                ORDER BY catalog.year DESC, catalog.set_name DESC,
                    catalog.name ASC, catalog.id ASC
            )
            FROM (
                SELECT
                    test.id,
                    test.name,
                    test.set_name,
                    test.year,
                    test.source,
                    test.description,
                    test.is_free,
                    test.total_questions,
                    test.duration_seconds
                FROM public.toeic_tests AS test
                WHERE test.status = 'published'
                  AND (p_year IS NULL OR test.year = p_year)
                  AND (v_set_name IS NULL OR test.set_name = v_set_name)
                  AND (v_source IS NULL OR test.source = v_source)
                ORDER BY test.year DESC, test.set_name DESC,
                    test.name ASC, test.id ASC
                LIMIT v_limit
                OFFSET v_offset
            ) AS catalog
        ), '[]'::JSONB)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_published_toeic_test_part(
    p_test_id UUID,
    p_part SMALLINT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_test RECORD;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'UNAUTHENTICATED';
    END IF;

    IF p_test_id IS NULL OR p_part IS NULL OR p_part NOT BETWEEN 1 AND 7 THEN
        RAISE EXCEPTION 'INVALID_INPUT';
    END IF;

    SELECT
        test.id,
        test.name,
        test.set_name,
        test.year,
        test.source,
        test.duration_seconds,
        test.status
    INTO v_test
    FROM public.toeic_tests AS test
    WHERE test.id = p_test_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'TEST_NOT_FOUND';
    END IF;

    IF v_test.status <> 'published' THEN
        RAISE EXCEPTION 'TEST_NOT_PUBLISHED';
    END IF;

    RETURN jsonb_build_object(
        'test', jsonb_build_object(
            'id', v_test.id,
            'name', v_test.name,
            'set_name', v_test.set_name,
            'year', v_test.year,
            'source', v_test.source,
            'duration_seconds', v_test.duration_seconds
        ),
        'part', p_part,
        'passages', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', passage.id,
                    'part', passage.part,
                    'passage_type', passage.passage_type,
                    'title', passage.title,
                    'content', jsonb_build_object(
                        'documents', COALESCE((
                            SELECT jsonb_agg(
                                jsonb_build_object(
                                    'type', document.value ->> 'type',
                                    'title', document.value ->> 'title',
                                    'body', document.value ->> 'body'
                                )
                                ORDER BY document.ordinality
                            )
                            FROM jsonb_array_elements(
                                CASE
                                    WHEN jsonb_typeof(passage.content -> 'documents') = 'array'
                                    THEN passage.content -> 'documents'
                                    ELSE '[]'::JSONB
                                END
                            ) WITH ORDINALITY AS document(value, ordinality)
                            WHERE jsonb_typeof(document.value) = 'object'
                        ), '[]'::JSONB)
                    ),
                    'audio_path', passage.audio_path,
                    'image_path', passage.image_path,
                    'position', passage.position
                )
                ORDER BY passage.position ASC, passage.id ASC
            )
            FROM public.toeic_passages AS passage
            WHERE passage.test_id = p_test_id
              AND passage.part = p_part
        ), '[]'::JSONB),
        'questions', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', question.id,
                    'passage_id', question.passage_id,
                    'part', question.part,
                    'section', question.section,
                    'question_number', question.question_number,
                    'question_text', question.question_text,
                    'options', jsonb_build_object(
                        'A', question.options -> 'A',
                        'B', question.options -> 'B',
                        'C', question.options -> 'C',
                        'D', question.options -> 'D'
                    ),
                    'audio_path', question.audio_path,
                    'image_path', question.image_path,
                    'position', question.position
                )
                ORDER BY question.position ASC, question.question_number ASC,
                    question.id ASC
            )
            FROM public.toeic_questions AS question
            WHERE question.test_id = p_test_id
              AND question.part = p_part
        ), '[]'::JSONB)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.list_published_toeic_tests(INTEGER, TEXT, TEXT, INTEGER, INTEGER)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_published_toeic_test_part(UUID, SMALLINT)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.list_published_toeic_tests(INTEGER, TEXT, TEXT, INTEGER, INTEGER)
TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_published_toeic_test_part(UUID, SMALLINT)
TO authenticated;

COMMENT ON FUNCTION public.list_published_toeic_tests(INTEGER, TEXT, TEXT, INTEGER, INTEGER)
IS 'Authenticated catalog projection. Excludes question content, answer keys, explanations and media URLs.';

COMMENT ON FUNCTION public.get_published_toeic_test_part(UUID, SMALLINT)
IS 'Authenticated test-taking projection. Excludes answer keys, transcripts, translations, explanations and vocabulary content.';
