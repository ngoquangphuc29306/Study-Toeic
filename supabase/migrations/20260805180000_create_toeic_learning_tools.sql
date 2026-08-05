-- Phase 10 owner-private learning tools.
CREATE TABLE public.toeic_test_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    test_id UUID NOT NULL REFERENCES public.toeic_tests(id) ON DELETE CASCADE,
    question_id UUID,
    content TEXT NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 5000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT toeic_test_notes_question_test_fk FOREIGN KEY (question_id, test_id)
        REFERENCES public.toeic_questions(id, test_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX toeic_test_notes_one_test_note ON public.toeic_test_notes(user_id, test_id) WHERE question_id IS NULL;
CREATE UNIQUE INDEX toeic_test_notes_one_question_note ON public.toeic_test_notes(user_id, test_id, question_id) WHERE question_id IS NOT NULL;
CREATE INDEX idx_toeic_test_notes_user_test ON public.toeic_test_notes(user_id, test_id, updated_at DESC);
CREATE TRIGGER set_updated_at_toeic_test_notes BEFORE UPDATE ON public.toeic_test_notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.toeic_text_annotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    test_id UUID NOT NULL REFERENCES public.toeic_tests(id) ON DELETE CASCADE, question_id UUID, passage_id UUID,
    document_index INTEGER, start_offset INTEGER NOT NULL CHECK (start_offset >= 0), end_offset INTEGER NOT NULL CHECK (end_offset > start_offset),
    quote TEXT NOT NULL CHECK (char_length(btrim(quote)) BETWEEN 1 AND 1000), style TEXT NOT NULL CHECK (style IN ('highlight', 'underline')),
    comment TEXT CHECK (comment IS NULL OR char_length(comment) <= 500), created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(), updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT toeic_text_annotations_one_target CHECK (((question_id IS NOT NULL)::INTEGER + (passage_id IS NOT NULL)::INTEGER) = 1),
    CONSTRAINT toeic_text_annotations_document_index_check CHECK (passage_id IS NULL OR (document_index IS NOT NULL AND document_index >= 0)),
    CONSTRAINT toeic_text_annotations_question_document_check CHECK (question_id IS NULL OR document_index IS NULL),
    CONSTRAINT toeic_text_annotations_question_test_fk FOREIGN KEY (question_id, test_id) REFERENCES public.toeic_questions(id, test_id) ON DELETE CASCADE,
    CONSTRAINT toeic_text_annotations_passage_test_fk FOREIGN KEY (passage_id, test_id) REFERENCES public.toeic_passages(id, test_id) ON DELETE CASCADE
);
CREATE INDEX idx_toeic_text_annotations_user_test ON public.toeic_text_annotations(user_id, test_id, created_at);
CREATE INDEX idx_toeic_text_annotations_question ON public.toeic_text_annotations(question_id) WHERE question_id IS NOT NULL;
CREATE INDEX idx_toeic_text_annotations_passage ON public.toeic_text_annotations(passage_id, document_index) WHERE passage_id IS NOT NULL;
CREATE TRIGGER set_updated_at_toeic_text_annotations BEFORE UPDATE ON public.toeic_text_annotations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.toeic_test_notes ENABLE ROW LEVEL SECURITY; ALTER TABLE public.toeic_test_notes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.toeic_text_annotations ENABLE ROW LEVEL SECURITY; ALTER TABLE public.toeic_text_annotations FORCE ROW LEVEL SECURITY;
CREATE POLICY toeic_test_notes_select_own ON public.toeic_test_notes FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY toeic_test_notes_insert_own ON public.toeic_test_notes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY toeic_test_notes_update_own ON public.toeic_test_notes FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY toeic_test_notes_delete_own ON public.toeic_test_notes FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY toeic_text_annotations_select_own ON public.toeic_text_annotations FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY toeic_text_annotations_insert_own ON public.toeic_text_annotations FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY toeic_text_annotations_update_own ON public.toeic_text_annotations FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY toeic_text_annotations_delete_own ON public.toeic_text_annotations FOR DELETE TO authenticated USING (user_id = auth.uid());
REVOKE ALL ON TABLE public.toeic_test_notes, public.toeic_text_annotations FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_toeic_notes(p_test_id UUID) RETURNS JSONB LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_user_id UUID := auth.uid(); v_result JSONB;
BEGIN
 IF v_user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = 'P0001'; END IF;
 IF p_test_id IS NULL THEN RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001'; END IF;
 IF NOT public.is_toeic_test_published(p_test_id) THEN RAISE EXCEPTION 'TEST_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',n.id,'testId',n.test_id,'questionId',n.question_id,'content',n.content,'createdAt',n.created_at,'updatedAt',n.updated_at) ORDER BY n.question_id NULLS FIRST,n.updated_at DESC),'[]'::JSONB) INTO v_result FROM public.toeic_test_notes n WHERE n.user_id=v_user_id AND n.test_id=p_test_id; RETURN v_result;
END; $$;

CREATE OR REPLACE FUNCTION public.upsert_toeic_note(p_test_id UUID,p_question_id UUID,p_content TEXT) RETURNS JSONB LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_user_id UUID:=auth.uid(); v_note public.toeic_test_notes%ROWTYPE;
BEGIN
 IF v_user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE='P0001'; END IF;
 IF p_test_id IS NULL OR char_length(btrim(COALESCE(p_content,''))) NOT BETWEEN 1 AND 5000 THEN RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE='P0001'; END IF;
 IF NOT public.is_toeic_test_published(p_test_id) THEN RAISE EXCEPTION 'TEST_NOT_FOUND' USING ERRCODE='P0001'; END IF;
 IF p_question_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.toeic_questions q WHERE q.id=p_question_id AND q.test_id=p_test_id) THEN RAISE EXCEPTION 'TARGET_NOT_FOUND' USING ERRCODE='P0001'; END IF;
 SELECT * INTO v_note FROM public.toeic_test_notes n WHERE n.user_id=v_user_id AND n.test_id=p_test_id AND ((p_question_id IS NULL AND n.question_id IS NULL) OR n.question_id=p_question_id);
 IF v_note.id IS NULL THEN INSERT INTO public.toeic_test_notes(user_id,test_id,question_id,content) VALUES(v_user_id,p_test_id,p_question_id,btrim(p_content)) RETURNING * INTO v_note; ELSE UPDATE public.toeic_test_notes SET content=btrim(p_content),updated_at=clock_timestamp() WHERE id=v_note.id RETURNING * INTO v_note; END IF;
 RETURN jsonb_build_object('id',v_note.id,'testId',v_note.test_id,'questionId',v_note.question_id,'content',v_note.content,'createdAt',v_note.created_at,'updatedAt',v_note.updated_at);
END; $$;

CREATE OR REPLACE FUNCTION public.delete_toeic_note(p_note_id UUID) RETURNS JSONB LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_user_id UUID:=auth.uid(); BEGIN IF v_user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE='P0001'; END IF; DELETE FROM public.toeic_test_notes WHERE id=p_note_id AND user_id=v_user_id; IF NOT FOUND THEN RAISE EXCEPTION 'NOTE_NOT_FOUND' USING ERRCODE='P0001'; END IF; RETURN jsonb_build_object('deleted',TRUE,'id',p_note_id); END; $$;

CREATE OR REPLACE FUNCTION public.get_toeic_annotations(p_test_id UUID,p_question_id UUID DEFAULT NULL,p_passage_id UUID DEFAULT NULL) RETURNS JSONB LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_user_id UUID:=auth.uid(); v_result JSONB; BEGIN
 IF v_user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE='P0001'; END IF;
 IF p_test_id IS NULL OR (p_question_id IS NOT NULL AND p_passage_id IS NOT NULL) THEN RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE='P0001'; END IF;
 IF NOT public.is_toeic_test_published(p_test_id) THEN RAISE EXCEPTION 'TEST_NOT_FOUND' USING ERRCODE='P0001'; END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',a.id,'testId',a.test_id,'questionId',a.question_id,'passageId',a.passage_id,'documentIndex',a.document_index,'startOffset',a.start_offset,'endOffset',a.end_offset,'quote',a.quote,'style',a.style,'comment',a.comment,'createdAt',a.created_at,'updatedAt',a.updated_at) ORDER BY a.start_offset,a.created_at),'[]'::JSONB) INTO v_result FROM public.toeic_text_annotations a WHERE a.user_id=v_user_id AND a.test_id=p_test_id AND (p_question_id IS NULL OR a.question_id=p_question_id) AND (p_passage_id IS NULL OR a.passage_id=p_passage_id); RETURN v_result;
END; $$;

CREATE OR REPLACE FUNCTION public.create_toeic_annotation(p_test_id UUID,p_question_id UUID,p_passage_id UUID,p_document_index INTEGER,p_start_offset INTEGER,p_end_offset INTEGER,p_quote TEXT,p_style TEXT,p_comment TEXT DEFAULT NULL) RETURNS JSONB LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_user_id UUID:=auth.uid(); v_annotation public.toeic_text_annotations%ROWTYPE; BEGIN
 IF v_user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE='P0001'; END IF;
 IF p_test_id IS NULL OR (p_question_id IS NULL AND p_passage_id IS NULL) OR (p_question_id IS NOT NULL AND p_passage_id IS NOT NULL) OR p_start_offset IS NULL OR p_end_offset IS NULL OR p_start_offset<0 OR p_end_offset<=p_start_offset OR char_length(btrim(COALESCE(p_quote,''))) NOT BETWEEN 1 AND 1000 OR p_style NOT IN('highlight','underline') OR (p_passage_id IS NOT NULL AND (p_document_index IS NULL OR p_document_index<0)) OR (p_question_id IS NOT NULL AND p_document_index IS NOT NULL) OR (p_comment IS NOT NULL AND char_length(p_comment)>500) THEN RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE='P0001'; END IF;
 IF NOT public.is_toeic_test_published(p_test_id) THEN RAISE EXCEPTION 'TEST_NOT_FOUND' USING ERRCODE='P0001'; END IF;
 IF p_question_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.toeic_questions q WHERE q.id=p_question_id AND q.test_id=p_test_id) THEN RAISE EXCEPTION 'TARGET_NOT_FOUND' USING ERRCODE='P0001'; END IF;
 IF p_passage_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.toeic_passages p WHERE p.id=p_passage_id AND p.test_id=p_test_id) THEN RAISE EXCEPTION 'TARGET_NOT_FOUND' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.toeic_text_annotations(user_id,test_id,question_id,passage_id,document_index,start_offset,end_offset,quote,style,comment) VALUES(v_user_id,p_test_id,p_question_id,p_passage_id,p_document_index,p_start_offset,p_end_offset,btrim(p_quote),p_style,NULLIF(btrim(p_comment),'')) RETURNING * INTO v_annotation;
 RETURN jsonb_build_object('id',v_annotation.id,'testId',v_annotation.test_id,'questionId',v_annotation.question_id,'passageId',v_annotation.passage_id,'documentIndex',v_annotation.document_index,'startOffset',v_annotation.start_offset,'endOffset',v_annotation.end_offset,'quote',v_annotation.quote,'style',v_annotation.style,'comment',v_annotation.comment,'createdAt',v_annotation.created_at,'updatedAt',v_annotation.updated_at);
END; $$;

CREATE OR REPLACE FUNCTION public.update_toeic_annotation(p_annotation_id UUID,p_start_offset INTEGER,p_end_offset INTEGER,p_quote TEXT,p_style TEXT,p_comment TEXT DEFAULT NULL) RETURNS JSONB LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_user_id UUID:=auth.uid(); v_annotation public.toeic_text_annotations%ROWTYPE; BEGIN
 IF v_user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE='P0001'; END IF;
 IF p_start_offset IS NULL OR p_end_offset<=p_start_offset OR p_start_offset<0 OR char_length(btrim(COALESCE(p_quote,''))) NOT BETWEEN 1 AND 1000 OR p_style NOT IN('highlight','underline') OR (p_comment IS NOT NULL AND char_length(p_comment)>500) THEN RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE='P0001'; END IF;
 UPDATE public.toeic_text_annotations SET start_offset=p_start_offset,end_offset=p_end_offset,quote=btrim(p_quote),style=p_style,comment=NULLIF(btrim(p_comment),''),updated_at=clock_timestamp() WHERE id=p_annotation_id AND user_id=v_user_id RETURNING * INTO v_annotation;
 IF v_annotation.id IS NULL THEN RAISE EXCEPTION 'ANNOTATION_NOT_FOUND' USING ERRCODE='P0001'; END IF;
 RETURN jsonb_build_object('id',v_annotation.id,'testId',v_annotation.test_id,'questionId',v_annotation.question_id,'passageId',v_annotation.passage_id,'documentIndex',v_annotation.document_index,'startOffset',v_annotation.start_offset,'endOffset',v_annotation.end_offset,'quote',v_annotation.quote,'style',v_annotation.style,'comment',v_annotation.comment,'createdAt',v_annotation.created_at,'updatedAt',v_annotation.updated_at);
END; $$;

CREATE OR REPLACE FUNCTION public.delete_toeic_annotation(p_annotation_id UUID) RETURNS JSONB LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_user_id UUID:=auth.uid(); BEGIN IF v_user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE='P0001'; END IF; DELETE FROM public.toeic_text_annotations WHERE id=p_annotation_id AND user_id=v_user_id; IF NOT FOUND THEN RAISE EXCEPTION 'ANNOTATION_NOT_FOUND' USING ERRCODE='P0001'; END IF; RETURN jsonb_build_object('deleted',TRUE,'id',p_annotation_id); END; $$;

REVOKE ALL ON FUNCTION public.get_toeic_notes(UUID),public.upsert_toeic_note(UUID,UUID,TEXT),public.delete_toeic_note(UUID),public.get_toeic_annotations(UUID,UUID,UUID),public.create_toeic_annotation(UUID,UUID,UUID,INTEGER,INTEGER,INTEGER,TEXT,TEXT,TEXT),public.update_toeic_annotation(UUID,INTEGER,INTEGER,TEXT,TEXT,TEXT),public.delete_toeic_annotation(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_toeic_notes(UUID),public.upsert_toeic_note(UUID,UUID,TEXT),public.delete_toeic_note(UUID),public.get_toeic_annotations(UUID,UUID,UUID),public.create_toeic_annotation(UUID,UUID,UUID,INTEGER,INTEGER,INTEGER,TEXT,TEXT,TEXT),public.update_toeic_annotation(UUID,INTEGER,INTEGER,TEXT,TEXT,TEXT),public.delete_toeic_annotation(UUID) TO authenticated;
