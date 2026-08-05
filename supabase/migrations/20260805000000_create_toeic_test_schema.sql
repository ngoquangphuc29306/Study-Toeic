-- =====================================================================
-- VOCABTOEIC - TOEIC TEST CONTENT AND ATTEMPT FOUNDATION
-- Migration Version: 20260805_000000
-- Scope: TOEIC content, answer-key isolation, attempt snapshots and RLS
-- =====================================================================

-- =====================================================================
-- SECTION 1: SMALL IMMUTABLE VALIDATION HELPERS
-- =====================================================================

CREATE OR REPLACE FUNCTION public.is_safe_toeic_media_path(p_path TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
    SELECT btrim(p_path) <> ''
       AND p_path !~ '://'
       AND replace(p_path, chr(92), '/') !~ '(^|/)\.\.(/|$)';
$$;

CREATE OR REPLACE FUNCTION public.is_valid_toeic_options(p_options JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
    SELECT jsonb_typeof(p_options) = 'object'
       AND p_options ?& ARRAY['A', 'B', 'C']
       AND NOT EXISTS (
           SELECT 1
           FROM jsonb_object_keys(p_options) AS option_key(key)
           WHERE option_key.key NOT IN ('A', 'B', 'C', 'D')
       )
       AND NOT EXISTS (
           SELECT 1
           FROM jsonb_object_keys(p_options) AS option_key(key)
           WHERE jsonb_typeof(p_options -> option_key.key) NOT IN ('string', 'null')
       );
$$;

CREATE OR REPLACE FUNCTION public.is_valid_toeic_parts(p_parts SMALLINT[])
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
    SELECT cardinality(p_parts) > 0
       AND p_parts <@ ARRAY[1, 2, 3, 4, 5, 6, 7]::SMALLINT[]
       AND cardinality(p_parts) = (
           SELECT count(DISTINCT part)::INTEGER
           FROM unnest(p_parts) AS selected_part(part)
       );
$$;

REVOKE ALL ON FUNCTION public.is_safe_toeic_media_path(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_valid_toeic_options(JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_valid_toeic_parts(SMALLINT[]) FROM PUBLIC, anon, authenticated;

-- =====================================================================
-- SECTION 2: SHARED CONTENT TABLES
-- =====================================================================

CREATE TABLE public.toeic_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL
        CHECK (char_length(btrim(name)) BETWEEN 1 AND 200),
    set_name TEXT NOT NULL
        CHECK (char_length(btrim(set_name)) BETWEEN 1 AND 100),
    year INTEGER NOT NULL
        CHECK (year BETWEEN 2000 AND 2100),
    source TEXT NOT NULL
        CHECK (char_length(btrim(source)) BETWEEN 1 AND 200),
    description TEXT,
    is_free BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'archived')),
    media_folder TEXT NOT NULL
        CHECK (
            char_length(btrim(media_folder)) BETWEEN 1 AND 500
            AND public.is_safe_toeic_media_path(media_folder)
        ),
    total_questions INTEGER NOT NULL
        CHECK (total_questions > 0),
    duration_seconds INTEGER NOT NULL
        CHECK (duration_seconds > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT toeic_tests_id_test_unique UNIQUE (id)
);

CREATE INDEX idx_toeic_tests_status_set_name
    ON public.toeic_tests(status, set_name);

CREATE INDEX idx_toeic_tests_year
    ON public.toeic_tests(year);

CREATE INDEX idx_toeic_tests_source
    ON public.toeic_tests(source);

CREATE TRIGGER set_updated_at_toeic_tests
    BEFORE UPDATE ON public.toeic_tests
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.toeic_passages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL
        REFERENCES public.toeic_tests(id)
        ON DELETE CASCADE,
    part SMALLINT NOT NULL
        CHECK (part BETWEEN 1 AND 7),
    passage_type TEXT,
    title TEXT,
    content JSONB NOT NULL DEFAULT '{"documents": []}'::JSONB
        CHECK (jsonb_typeof(content) = 'object'),
    transcript TEXT,
    translation TEXT,
    audio_path TEXT
        CHECK (audio_path IS NULL OR public.is_safe_toeic_media_path(audio_path)),
    image_path TEXT
        CHECK (image_path IS NULL OR public.is_safe_toeic_media_path(image_path)),
    position INTEGER NOT NULL
        CHECK (position >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT toeic_passages_id_test_unique UNIQUE (id, test_id),
    CONSTRAINT toeic_passages_test_position_unique UNIQUE (test_id, position)
);

CREATE INDEX idx_toeic_passages_test_part
    ON public.toeic_passages(test_id, part);

CREATE TRIGGER set_updated_at_toeic_passages
    BEFORE UPDATE ON public.toeic_passages
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.toeic_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL
        REFERENCES public.toeic_tests(id)
        ON DELETE CASCADE,
    passage_id UUID,
    part SMALLINT NOT NULL
        CHECK (part BETWEEN 1 AND 7),
    section TEXT NOT NULL
        CHECK (section IN ('listening', 'reading')),
    question_number INTEGER NOT NULL
        CHECK (question_number > 0),
    question_text TEXT,
    options JSONB NOT NULL
        CHECK (public.is_valid_toeic_options(options)),
    explanation_en TEXT,
    explanation_vi TEXT,
    ai_explanation TEXT,
    vocabulary_content JSONB
        CHECK (vocabulary_content IS NULL OR jsonb_typeof(vocabulary_content) = 'object'),
    audio_path TEXT
        CHECK (audio_path IS NULL OR public.is_safe_toeic_media_path(audio_path)),
    image_path TEXT
        CHECK (image_path IS NULL OR public.is_safe_toeic_media_path(image_path)),
    position INTEGER NOT NULL
        CHECK (position >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT toeic_questions_section_part_check
        CHECK (
            (part BETWEEN 1 AND 4 AND section = 'listening')
            OR (part BETWEEN 5 AND 7 AND section = 'reading')
        ),
    CONSTRAINT toeic_questions_id_test_unique UNIQUE (id, test_id),
    CONSTRAINT toeic_questions_id_test_part_unique UNIQUE (id, test_id, part),
    CONSTRAINT toeic_questions_test_question_number_unique UNIQUE (test_id, question_number),
    CONSTRAINT toeic_questions_test_position_unique UNIQUE (test_id, position),
    CONSTRAINT toeic_questions_passage_same_test_fk
        FOREIGN KEY (passage_id, test_id)
        REFERENCES public.toeic_passages(id, test_id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_toeic_questions_test_part_question
    ON public.toeic_questions(test_id, part, question_number);

CREATE INDEX idx_toeic_questions_passage_question
    ON public.toeic_questions(passage_id, question_number)
    WHERE passage_id IS NOT NULL;

CREATE TRIGGER set_updated_at_toeic_questions
    BEFORE UPDATE ON public.toeic_questions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- The answer key is intentionally not part of toeic_questions.
CREATE TABLE public.toeic_question_answer_keys (
    question_id UUID PRIMARY KEY
        REFERENCES public.toeic_questions(id)
        ON DELETE CASCADE,
    correct_answer TEXT NOT NULL
        CHECK (correct_answer IN ('A', 'B', 'C', 'D')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TRIGGER set_updated_at_toeic_question_answer_keys
    BEFORE UPDATE ON public.toeic_question_answer_keys
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- SECTION 3: USER ATTEMPTS AND QUESTION SNAPSHOTS
-- =====================================================================

CREATE TABLE public.toeic_test_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,
    test_id UUID NOT NULL
        REFERENCES public.toeic_tests(id)
        ON DELETE RESTRICT,
    mode TEXT NOT NULL
        CHECK (mode IN ('exam', 'practice')),
    status TEXT NOT NULL DEFAULT 'in_progress'
        CHECK (status IN ('in_progress', 'submitted', 'abandoned', 'expired')),
    selected_parts SMALLINT[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5, 6, 7]::SMALLINT[]
        CHECK (public.is_valid_toeic_parts(selected_parts)),
    started_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    deadline_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    submit_idempotency_key UUID,
    submission_result JSONB
        CHECK (submission_result IS NULL OR jsonb_typeof(submission_result) = 'object'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT toeic_attempt_exam_deadline_check
        CHECK (mode <> 'exam' OR deadline_at IS NOT NULL),
    CONSTRAINT toeic_attempt_deadline_after_start_check
        CHECK (deadline_at IS NULL OR deadline_at > started_at),
    CONSTRAINT toeic_attempt_submitted_at_check
        CHECK (status <> 'submitted' OR submitted_at IS NOT NULL),
    CONSTRAINT toeic_attempt_in_progress_not_submitted_check
        CHECK (status <> 'in_progress' OR submitted_at IS NULL),
    CONSTRAINT toeic_attempt_user_submit_key_unique
        UNIQUE (user_id, submit_idempotency_key),
    CONSTRAINT toeic_attempt_id_test_unique UNIQUE (id, test_id)
);

CREATE INDEX idx_toeic_attempts_user_started_at
    ON public.toeic_test_attempts(user_id, started_at DESC);

CREATE INDEX idx_toeic_attempts_user_status
    ON public.toeic_test_attempts(user_id, status);

CREATE INDEX idx_toeic_attempts_test_id
    ON public.toeic_test_attempts(test_id);

CREATE INDEX idx_toeic_attempts_in_progress_user_test
    ON public.toeic_test_attempts(user_id, test_id)
    WHERE status = 'in_progress';

CREATE TRIGGER set_updated_at_toeic_test_attempts
    BEFORE UPDATE ON public.toeic_test_attempts
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.toeic_attempt_questions (
    attempt_id UUID NOT NULL,
    test_id UUID NOT NULL,
    question_id UUID NOT NULL,
    part SMALLINT NOT NULL
        CHECK (part BETWEEN 1 AND 7),
    position INTEGER NOT NULL
        CHECK (position >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (attempt_id, question_id),
    CONSTRAINT toeic_attempt_questions_position_unique
        UNIQUE (attempt_id, position),
    CONSTRAINT toeic_attempt_questions_attempt_test_fk
        FOREIGN KEY (attempt_id, test_id)
        REFERENCES public.toeic_test_attempts(id, test_id)
        ON DELETE CASCADE,
    CONSTRAINT toeic_attempt_questions_question_test_part_fk
        FOREIGN KEY (question_id, test_id, part)
        REFERENCES public.toeic_questions(id, test_id, part)
        ON DELETE RESTRICT
);

CREATE INDEX idx_toeic_attempt_questions_question_id
    ON public.toeic_attempt_questions(question_id);

CREATE TABLE public.toeic_test_answers (
    attempt_id UUID NOT NULL,
    question_id UUID NOT NULL,
    selected_answer TEXT
        CHECK (selected_answer IS NULL OR selected_answer IN ('A', 'B', 'C', 'D')),
    is_flagged BOOLEAN NOT NULL DEFAULT FALSE,
    answered_at TIMESTAMPTZ,
    time_spent_seconds INTEGER
        CHECK (time_spent_seconds IS NULL OR time_spent_seconds >= 0),
    is_correct BOOLEAN,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (attempt_id, question_id),
    CONSTRAINT toeic_test_answers_attempt_question_fk
        FOREIGN KEY (attempt_id, question_id)
        REFERENCES public.toeic_attempt_questions(attempt_id, question_id)
        ON DELETE CASCADE
);

CREATE TRIGGER set_updated_at_toeic_test_answers
    BEFORE UPDATE ON public.toeic_test_answers
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- SECTION 4: RLS HELPERS
-- =====================================================================

CREATE OR REPLACE FUNCTION public.is_toeic_test_published(p_test_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.toeic_tests
        WHERE id = p_test_id
          AND status = 'published'
    );
$$;

CREATE OR REPLACE FUNCTION public.owns_toeic_attempt(p_attempt_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.toeic_test_attempts
        WHERE id = p_attempt_id
          AND user_id = auth.uid()
    );
$$;

REVOKE ALL ON FUNCTION public.is_toeic_test_published(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owns_toeic_attempt(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_toeic_test_published(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_toeic_attempt(UUID) TO authenticated;

COMMENT ON FUNCTION public.is_toeic_test_published(UUID)
IS 'RLS helper that checks published TOEIC content without exposing rows.';

COMMENT ON FUNCTION public.owns_toeic_attempt(UUID)
IS 'RLS helper that checks current-user ownership of a TOEIC attempt.';

-- =====================================================================
-- SECTION 5: RLS POLICIES
-- =====================================================================

ALTER TABLE public.toeic_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toeic_passages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toeic_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toeic_question_answer_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toeic_test_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toeic_attempt_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toeic_test_answers ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.toeic_tests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.toeic_passages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.toeic_questions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.toeic_question_answer_keys FORCE ROW LEVEL SECURITY;
ALTER TABLE public.toeic_test_attempts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.toeic_attempt_questions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.toeic_test_answers FORCE ROW LEVEL SECURITY;

CREATE POLICY toeic_tests_select_published
    ON public.toeic_tests
    FOR SELECT
    TO authenticated
    USING (status = 'published');

CREATE POLICY toeic_passages_select_published
    ON public.toeic_passages
    FOR SELECT
    TO authenticated
    USING (public.is_toeic_test_published(test_id));

CREATE POLICY toeic_questions_select_published
    ON public.toeic_questions
    FOR SELECT
    TO authenticated
    USING (public.is_toeic_test_published(test_id));

CREATE POLICY toeic_attempts_select_own
    ON public.toeic_test_attempts
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY toeic_attempt_questions_select_own
    ON public.toeic_attempt_questions
    FOR SELECT
    TO authenticated
    USING (public.owns_toeic_attempt(attempt_id));

CREATE POLICY toeic_test_answers_select_own
    ON public.toeic_test_answers
    FOR SELECT
    TO authenticated
    USING (public.owns_toeic_attempt(attempt_id));

-- No policy is created for toeic_question_answer_keys. With RLS enabled and
-- no SELECT grant/policy, browser roles cannot read the answer key.

-- =====================================================================
-- SECTION 6: TABLE PRIVILEGES
-- =====================================================================

REVOKE ALL ON TABLE public.toeic_tests,
    public.toeic_passages,
    public.toeic_questions,
    public.toeic_question_answer_keys,
    public.toeic_test_attempts,
    public.toeic_attempt_questions,
    public.toeic_test_answers
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.toeic_tests,
    public.toeic_passages,
    public.toeic_questions,
    public.toeic_test_attempts,
    public.toeic_attempt_questions,
    public.toeic_test_answers
TO authenticated;

COMMENT ON TABLE public.toeic_tests
IS 'Shared TOEIC test catalog. Only published content is readable by authenticated users.';

COMMENT ON TABLE public.toeic_passages
IS 'Structured TOEIC passage content. content JSONB supports single, double, triple and document combinations.';

COMMENT ON TABLE public.toeic_questions
IS 'Client-safe TOEIC question content. Correct answers are stored in toeic_question_answer_keys.';

COMMENT ON TABLE public.toeic_question_answer_keys
IS 'Server-controlled TOEIC answer keys. No browser role has table privileges or RLS SELECT policy.';

COMMENT ON TABLE public.toeic_test_attempts
IS 'User-owned TOEIC attempt lifecycle. Creation and submission are reserved for future server RPCs.';

COMMENT ON TABLE public.toeic_attempt_questions
IS 'Immutable question snapshot for an attempt, including selected-part and ordering invariants.';

COMMENT ON TABLE public.toeic_test_answers
IS 'User-visible answer state. is_correct is server-owned; Phase 2 grants read-only access.';
