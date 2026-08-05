-- Phase 8: owner-authorized learning feedback boundaries.
-- The safe test-taking RPC remains unchanged and continues to exclude all of
-- these fields. These functions expose learning content only at the explicit
-- practice-check or post-submit review boundary.

CREATE OR REPLACE FUNCTION public.check_toeic_practice_answer(
    p_attempt_id UUID,
    p_question_id UUID
)
RETURNS JSONB
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_attempt RECORD;
    v_result JSONB;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = 'P0001';
    END IF;
    IF p_attempt_id IS NULL OR p_question_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
    END IF;

    SELECT attempt.user_id, attempt.test_id, attempt.mode, attempt.status
    INTO v_attempt
    FROM public.toeic_test_attempts AS attempt
    WHERE attempt.id = p_attempt_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ATTEMPT_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    IF v_attempt.user_id <> v_user_id THEN
        RAISE EXCEPTION 'ATTEMPT_NOT_OWNED' USING ERRCODE = 'P0001';
    END IF;
    IF v_attempt.mode <> 'practice' THEN
        RAISE EXCEPTION 'PRACTICE_ONLY' USING ERRCODE = 'P0001';
    END IF;
    IF v_attempt.status <> 'in_progress' THEN
        RAISE EXCEPTION 'ATTEMPT_NOT_ACTIVE' USING ERRCODE = 'P0001';
    END IF;

    SELECT jsonb_build_object(
        'attemptId', p_attempt_id,
        'questionId', attempt_question.question_id,
        'passageId', question.passage_id,
        'questionNumber', question.question_number,
        'part', attempt_question.part,
        'selectedAnswer', answer.selected_answer,
        'correctAnswer', answer_key.correct_answer,
        'isCorrect', answer.selected_answer = answer_key.correct_answer,
        'explanationEn', question.explanation_en,
        'explanationVi', question.explanation_vi,
        'aiExplanation', question.ai_explanation,
        'transcript', passage.transcript,
        'translation', passage.translation,
        'vocabulary', question.vocabulary_content
    )
    INTO v_result
    FROM public.toeic_attempt_questions AS attempt_question
    JOIN public.toeic_questions AS question
      ON question.id = attempt_question.question_id
     AND question.test_id = attempt_question.test_id
     AND question.part = attempt_question.part
    JOIN public.toeic_question_answer_keys AS answer_key
      ON answer_key.question_id = attempt_question.question_id
    LEFT JOIN public.toeic_test_answers AS answer
      ON answer.attempt_id = attempt_question.attempt_id
     AND answer.question_id = attempt_question.question_id
    LEFT JOIN public.toeic_passages AS passage
      ON passage.id = question.passage_id
     AND passage.test_id = question.test_id
    WHERE attempt_question.attempt_id = p_attempt_id
      AND attempt_question.question_id = p_question_id
      AND answer.selected_answer IS NOT NULL;

    IF v_result IS NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.toeic_attempt_questions AS attempt_question
            WHERE attempt_question.attempt_id = p_attempt_id
              AND attempt_question.question_id = p_question_id
        ) THEN
            RAISE EXCEPTION 'QUESTION_NOT_IN_ATTEMPT' USING ERRCODE = 'P0001';
        END IF;
        RAISE EXCEPTION 'ANSWER_NOT_SAVED' USING ERRCODE = 'P0001';
    END IF;

    RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_toeic_attempt_review_content(
    p_attempt_id UUID
)
RETURNS JSONB
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_attempt RECORD;
    v_missing_keys INTEGER;
    v_result JSONB;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = 'P0001';
    END IF;
    IF p_attempt_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
    END IF;

    SELECT attempt.user_id, attempt.test_id, attempt.status
    INTO v_attempt
    FROM public.toeic_test_attempts AS attempt
    WHERE attempt.id = p_attempt_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ATTEMPT_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    IF v_attempt.user_id <> v_user_id THEN
        RAISE EXCEPTION 'ATTEMPT_NOT_OWNED' USING ERRCODE = 'P0001';
    END IF;
    IF v_attempt.status <> 'submitted' THEN
        RAISE EXCEPTION 'ATTEMPT_NOT_SUBMITTED' USING ERRCODE = 'P0001';
    END IF;

    SELECT count(*)::INTEGER
    INTO v_missing_keys
    FROM public.toeic_attempt_questions AS attempt_question
    LEFT JOIN public.toeic_question_answer_keys AS answer_key
      ON answer_key.question_id = attempt_question.question_id
    WHERE attempt_question.attempt_id = p_attempt_id
      AND answer_key.question_id IS NULL;
    IF v_missing_keys > 0 THEN
        RAISE EXCEPTION 'ANSWER_KEY_INCOMPLETE' USING ERRCODE = 'P0001';
    END IF;

    SELECT jsonb_build_object(
        'attemptId', p_attempt_id,
        'testId', v_attempt.test_id,
        'status', 'submitted',
        'questions', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'attemptId', p_attempt_id,
                'questionId', attempt_question.question_id,
                'passageId', question.passage_id,
                'questionNumber', question.question_number,
                'part', attempt_question.part,
                'selectedAnswer', answer.selected_answer,
                'correctAnswer', answer_key.correct_answer,
                'isCorrect', answer.is_correct,
                'isFlagged', COALESCE(answer.is_flagged, FALSE),
                'explanationEn', question.explanation_en,
                'explanationVi', question.explanation_vi,
                'aiExplanation', question.ai_explanation,
                'transcript', passage.transcript,
                'translation', passage.translation,
                'vocabulary', question.vocabulary_content
            ) ORDER BY attempt_question.position ASC, attempt_question.question_id ASC)
            FROM public.toeic_attempt_questions AS attempt_question
            JOIN public.toeic_questions AS question
              ON question.id = attempt_question.question_id
             AND question.test_id = attempt_question.test_id
             AND question.part = attempt_question.part
            JOIN public.toeic_question_answer_keys AS answer_key
              ON answer_key.question_id = attempt_question.question_id
            LEFT JOIN public.toeic_test_answers AS answer
              ON answer.attempt_id = attempt_question.attempt_id
             AND answer.question_id = attempt_question.question_id
            LEFT JOIN public.toeic_passages AS passage
              ON passage.id = question.passage_id
             AND passage.test_id = question.test_id
            WHERE attempt_question.attempt_id = p_attempt_id
        ), '[]'::JSONB),
        'passages', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'passageId', passage_rows.passage_id,
                'transcript', passage_rows.transcript,
                'translation', passage_rows.translation
            ) ORDER BY passage_rows.position ASC, passage_rows.passage_id ASC)
            FROM (
                SELECT DISTINCT passage.id AS passage_id, passage.transcript, passage.translation, passage.position
                FROM public.toeic_attempt_questions AS attempt_question
                JOIN public.toeic_questions AS question
                  ON question.id = attempt_question.question_id
                 AND question.test_id = attempt_question.test_id
                 AND question.part = attempt_question.part
                JOIN public.toeic_passages AS passage
                  ON passage.id = question.passage_id
                 AND passage.test_id = question.test_id
                WHERE attempt_question.attempt_id = p_attempt_id
            ) AS passage_rows
        ), '[]'::JSONB)
    )
    INTO v_result;

    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.check_toeic_practice_answer(UUID, UUID)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_toeic_attempt_review_content(UUID)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.check_toeic_practice_answer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_toeic_attempt_review_content(UUID) TO authenticated;

COMMENT ON FUNCTION public.check_toeic_practice_answer(UUID, UUID)
IS 'Returns learning feedback for one saved answer in an owner practice attempt; never writes answer correctness.';
COMMENT ON FUNCTION public.get_toeic_attempt_review_content(UUID)
IS 'Returns owner-only learning content and answer keys for a submitted attempt.';
