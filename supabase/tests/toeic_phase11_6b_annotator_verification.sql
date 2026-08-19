DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'toeic_text_annotations' AND column_name = 'annotation_type'
    ) THEN RAISE EXCEPTION 'Rich annotator type column missing'; END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'toeic_text_annotations' AND column_name = 'geometry'
    ) THEN RAISE EXCEPTION 'Rich annotator geometry column missing'; END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'create_toeic_annotator_annotation'
    ) THEN RAISE EXCEPTION 'Rich annotator RPC missing'; END IF;
    IF has_table_privilege('authenticated', 'public.toeic_text_annotations', 'INSERT')
       OR has_table_privilege('authenticated', 'public.toeic_text_annotations', 'UPDATE')
       OR has_table_privilege('authenticated', 'public.toeic_text_annotations', 'DELETE')
    THEN RAISE EXCEPTION 'Browser direct annotation mutation privilege must remain revoked'; END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'toeic_text_annotations' AND policyname = 'toeic_text_annotations_select_own'
    ) THEN RAISE EXCEPTION 'Annotation owner policy missing'; END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.toeic_text_annotations'::regclass AND conname = 'toeic_text_annotations_type_check'
    ) THEN RAISE EXCEPTION 'Annotation type allowlist missing'; END IF;
END $$;
