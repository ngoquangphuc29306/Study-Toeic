-- =====================================================================
-- VOCABTOEIC - PHASE 1A: INITIAL VERTICAL SLICE RLS
-- Migration Version: 20260730_184632
-- Purpose: Enforce private per-user access
-- Scope: collections, topics, vocabularies
-- =====================================================================

-- =====================================================================
-- SECTION 1: ENABLE RLS
-- =====================================================================

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocabularies ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.collections FORCE ROW LEVEL SECURITY;
ALTER TABLE public.topics FORCE ROW LEVEL SECURITY;
ALTER TABLE public.vocabularies FORCE ROW LEVEL SECURITY;

-- =====================================================================
-- SECTION 2: COLLECTION POLICIES
-- =====================================================================

CREATE POLICY collections_select_own
    ON public.collections
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
    );

CREATE POLICY collections_insert_own
    ON public.collections
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
    );

CREATE POLICY collections_update_own
    ON public.collections
    FOR UPDATE
    TO authenticated
    USING (
        user_id = auth.uid()
    )
    WITH CHECK (
        user_id = auth.uid()
    );

CREATE POLICY collections_delete_own
    ON public.collections
    FOR DELETE
    TO authenticated
    USING (
        user_id = auth.uid()
    );

-- =====================================================================
-- SECTION 3: TOPIC POLICIES
-- =====================================================================

CREATE POLICY topics_select_own
    ON public.topics
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
    );

CREATE POLICY topics_insert_own
    ON public.topics
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1
            FROM public.collections AS c
            WHERE c.id = collection_id
              AND c.user_id = auth.uid()
        )
    );

CREATE POLICY topics_update_own
    ON public.topics
    FOR UPDATE
    TO authenticated
    USING (
        user_id = auth.uid()
    )
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1
            FROM public.collections AS c
            WHERE c.id = collection_id
              AND c.user_id = auth.uid()
        )
    );

CREATE POLICY topics_delete_own
    ON public.topics
    FOR DELETE
    TO authenticated
    USING (
        user_id = auth.uid()
    );

-- =====================================================================
-- SECTION 4: VOCABULARY POLICIES
-- =====================================================================

CREATE POLICY vocabularies_select_own
    ON public.vocabularies
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
    );

CREATE POLICY vocabularies_insert_own
    ON public.vocabularies
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1
            FROM public.topics AS t
            WHERE t.id = topic_id
              AND t.user_id = auth.uid()
        )
    );

CREATE POLICY vocabularies_update_own
    ON public.vocabularies
    FOR UPDATE
    TO authenticated
    USING (
        user_id = auth.uid()
    )
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1
            FROM public.topics AS t
            WHERE t.id = topic_id
              AND t.user_id = auth.uid()
        )
    );

CREATE POLICY vocabularies_delete_own
    ON public.vocabularies
    FOR DELETE
    TO authenticated
    USING (
        user_id = auth.uid()
    );

-- =====================================================================
-- SECTION 5: TABLE PRIVILEGES
-- =====================================================================

REVOKE ALL ON TABLE public.collections
FROM PUBLIC, anon;

REVOKE ALL ON TABLE public.topics
FROM PUBLIC, anon;

REVOKE ALL ON TABLE public.vocabularies
FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.collections
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.topics
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.vocabularies
TO authenticated;