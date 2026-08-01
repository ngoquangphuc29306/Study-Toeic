-- =====================================================================
-- VOCABTOEIC - PHASE 5: REVIEW_LOGS RLS POLICIES
-- Migration Version: 20260731_093118
-- Purpose: Enforce read-only access and RPC-only insertion
-- Scope: RLS policies for review_logs
-- =====================================================================

-- =====================================================================
-- SECTION 1: ENABLE RLS
-- =====================================================================

ALTER TABLE public.review_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_logs FORCE ROW LEVEL SECURITY;

-- =====================================================================
-- SECTION 2: REVIEW LOGS POLICIES
-- =====================================================================

-- Users can read their own review logs
CREATE POLICY review_logs_select_own
    ON public.review_logs
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
    );

-- No direct INSERT/UPDATE/DELETE from browser
-- Logs are inserted only via submit_vocabulary_rating RPC (SECURITY DEFINER)

-- =====================================================================
-- SECTION 3: TABLE PRIVILEGES
-- =====================================================================

REVOKE ALL ON TABLE public.review_logs
FROM PUBLIC, anon, authenticated;

-- Grant SELECT only (via RLS policy above)
GRANT SELECT ON TABLE public.review_logs
TO authenticated;

-- Grant EXECUTE on rating RPC
GRANT EXECUTE ON FUNCTION public.submit_vocabulary_rating(UUID, TEXT, UUID)
TO authenticated;
