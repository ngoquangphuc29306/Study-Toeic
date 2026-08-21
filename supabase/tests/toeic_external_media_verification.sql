-- Phase 11.5 external media constraint verification.
-- Run after `supabase db reset` in the local database.

DO $$
BEGIN
    IF NOT public.is_safe_toeic_media_path('2026/test-1/part-3/audio.mp3') THEN
        RAISE EXCEPTION 'relative TOEIC media path was rejected';
    END IF;

    IF NOT public.is_safe_toeic_media_path('https://media.example.com/test-1/audio.mp3?token=redacted') THEN
        RAISE EXCEPTION 'HTTPS external TOEIC media URL was rejected';
    END IF;

    IF public.is_safe_toeic_media_path('http://media.example.com/test-1/audio.mp3') THEN
        RAISE EXCEPTION 'HTTP external media URL was accepted';
    END IF;

    IF public.is_safe_toeic_media_path('https://localhost/test-1/audio.mp3') THEN
        RAISE EXCEPTION 'localhost media URL was accepted';
    END IF;

    IF public.is_safe_toeic_media_path('https://media.example.com/../audio.mp3') THEN
        RAISE EXCEPTION 'traversal media URL was accepted';
    END IF;
END;
$$;
