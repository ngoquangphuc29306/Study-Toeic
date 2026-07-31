-- =====================================================================
-- VOCABTOEIC - PHASE 5: USER_VOCAB_PROGRESS RLS POLICIES
-- Migration Version: 20260731_093117
-- Purpose: Enforce private per-user access to progress data
-- Scope: RLS policies for user_vocab_progress
-- =====================================================================

-- =====================================================================
-- SECTION 1: ENABLE RLS
-- =====================================================================

ALTER TABLE public.user_vocab_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_vocab_progress FORCE ROW LEVEL SECURITY;

-- =====================================================================
-- SECTION 2: PROGRESS POLICIES
-- =====================================================================

CREATE POLICY user_vocab_progress_select_own
    ON public.user_vocab_progress
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
    );

CREATE POLICY user_vocab_progress_insert_own
    ON public.user_vocab_progress
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1
            FROM public.vocabularies AS v
            WHERE v.id = vocabulary_id
              AND v.user_id = auth.uid()
        )
    );

CREATE POLICY user_vocab_progress_update_own
    ON public.user_vocab_progress
    FOR UPDATE
    TO authenticated
    USING (
        user_id = auth.uid()
    )
    WITH CHECK (
        user_id = auth.uid()
    );

CREATE POLICY user_vocab_progress_delete_own
    ON public.user_vocab_progress
    FOR DELETE
    TO authenticated
    USING (
        user_id = auth.uid()
    );

-- =====================================================================
-- SECTION 3: TABLE PRIVILEGES
-- =====================================================================

REVOKE ALL ON TABLE public.user_vocab_progress
FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.user_vocab_progress
TO authenticated;
