-- Phase 10 SQL verification. Run after db reset in a local Supabase instance.
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'toeic_test_notes') THEN RAISE EXCEPTION 'Phase 10 notes table missing'; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'toeic_text_annotations') THEN RAISE EXCEPTION 'Phase 10 annotations table missing'; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_toeic_notes') THEN RAISE EXCEPTION 'Phase 10 notes RPC missing'; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_toeic_annotation') THEN RAISE EXCEPTION 'Phase 10 annotation RPC missing'; END IF;
    IF has_table_privilege('authenticated', 'public.toeic_test_notes', 'INSERT') OR has_table_privilege('authenticated', 'public.toeic_text_annotations', 'INSERT') THEN RAISE EXCEPTION 'Browser direct mutation privilege must remain revoked'; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'toeic_test_notes' AND policyname = 'toeic_test_notes_select_own') THEN RAISE EXCEPTION 'Notes owner policy missing'; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'toeic_text_annotations' AND policyname = 'toeic_text_annotations_select_own') THEN RAISE EXCEPTION 'Annotation owner policy missing'; END IF;
END $$;
