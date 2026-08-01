-- =====================================================================
-- VOCABTOEIC - PHASE 9.6: USER PROFILES AND AVATAR MANAGEMENT
-- Migration Version: 20260801_124424
-- Purpose: Add user profiles with display names and avatar storage
-- Scope: profiles table, avatars bucket, RLS policies
-- =====================================================================

-- =====================================================================
-- SECTION 1: PROFILES TABLE
-- =====================================================================

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    display_name TEXT
        CHECK (
            display_name IS NULL
            OR (
                char_length(btrim(display_name)) >= 1
                AND char_length(display_name) <= 80
            )
        ),

    avatar_path TEXT
        CHECK (
            avatar_path IS NULL
            OR char_length(avatar_path) <= 500
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_profiles_id
    ON public.profiles(id);

CREATE TRIGGER set_updated_at_profiles
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.profiles
IS 'User profile information. One profile per authenticated user.';

COMMENT ON COLUMN public.profiles.id
IS 'User ID from auth.users. Profile ownership enforced by RLS.';

COMMENT ON COLUMN public.profiles.display_name
IS 'User display name. Nullable. 1-80 characters when provided. Trimmed before storage.';

COMMENT ON COLUMN public.profiles.avatar_path
IS 'Storage path to avatar image. Format: <user-id>/avatar.<ext>. Not a signed URL.';

-- =====================================================================
-- SECTION 2: PROFILES RLS
-- =====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_own
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        id = auth.uid()
    );

CREATE POLICY profiles_insert_own
    ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (
        id = auth.uid()
    );

CREATE POLICY profiles_update_own
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (
        id = auth.uid()
    )
    WITH CHECK (
        id = auth.uid()
    );

-- No DELETE policy - account deletion is out of scope for Phase 9.6
-- Profile rows are cascade-deleted when auth.users row is deleted

-- =====================================================================
-- SECTION 3: TABLE PRIVILEGES
-- =====================================================================

REVOKE ALL ON TABLE public.profiles
FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.profiles
TO authenticated;

-- =====================================================================
-- SECTION 4: STORAGE BUCKET (via Dashboard or supabase CLI)
-- =====================================================================

-- IMPORTANT: Supabase SQL migrations cannot create Storage buckets directly.
-- Execute via Supabase Dashboard or CLI:
--
-- Bucket name: avatars
-- Public: false (private bucket)
-- File size limit: 2 MB
-- Allowed MIME types: image/jpeg, image/png, image/webp
--
-- Or via supabase CLI:
-- supabase storage create --bucket avatars --public false

-- =====================================================================
-- SECTION 5: STORAGE POLICIES
-- =====================================================================

-- Storage policy: Users can insert only into their own folder
CREATE POLICY avatars_insert_own
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Storage policy: Users can update only files in their own folder
CREATE POLICY avatars_update_own
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Storage policy: Users can delete only files in their own folder
CREATE POLICY avatars_delete_own
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Storage policy: Users can read only their own avatar files
CREATE POLICY avatars_select_own
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );
