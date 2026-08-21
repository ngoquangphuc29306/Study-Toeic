-- =====================================================================
-- TOEIC MEDIA - SERVER MEDIA RESOLVER READ PRIVILEGES
-- Migration Version: 20260809_100000
-- Scope: allow the server-only media resolver to read referenced media
-- metadata without exposing direct browser table access.
-- =====================================================================

GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT ON TABLE
    public.toeic_tests,
    public.toeic_passages,
    public.toeic_questions
TO service_role;

-- Deliberately do not grant access to answer keys, attempts, answers, or
-- any other TOEIC tables. Browser roles remain governed by the safe read RPCs.
