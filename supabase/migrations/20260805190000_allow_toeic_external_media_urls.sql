-- =====================================================================
-- TOEIC TEST - EXTERNAL MEDIA SOURCE SUPPORT
-- Migration Version: 20260805_190000
-- Scope: allow validated HTTPS media values alongside storage paths
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
       AND char_length(btrim(p_path)) <= 2048
       AND (
           (
               p_path !~ '://'
               AND replace(p_path, chr(92), '/') !~ '(^|/)\.\.(/|$)'
           )
           OR
           (
               p_path ~ '^https://[^[:space:]]+$'
               AND p_path !~ '^https://[^/?#]*@'
               AND p_path !~* '^https://(localhost|[^/?#]*\.localhost|127\.|0\.0\.0\.0|169\.254\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)'
               AND p_path !~* '^https://\[::1\]'
               AND replace(p_path, chr(92), '/') = p_path
               AND replace(p_path, chr(92), '/') !~ '(^|/)\.\.(/|$)'
           )
       );
$$;

REVOKE ALL ON FUNCTION public.is_safe_toeic_media_path(TEXT) FROM PUBLIC, anon, authenticated;

ALTER TABLE public.toeic_tests
    DROP CONSTRAINT IF EXISTS toeic_tests_media_folder_check;

ALTER TABLE public.toeic_tests
    ADD CONSTRAINT toeic_tests_media_folder_check
    CHECK (
        char_length(btrim(media_folder)) BETWEEN 1 AND 500
        AND media_folder !~ '://'
        AND public.is_safe_toeic_media_path(media_folder)
    );
