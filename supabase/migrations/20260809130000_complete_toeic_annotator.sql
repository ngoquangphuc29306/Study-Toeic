-- Phase 11.6B: server-authoritative rich annotator payloads.
-- The original text-annotation RPCs remain compatible; this migration only
-- extends their storage and adds a typed mutation boundary for rich tools.
ALTER TABLE public.toeic_text_annotations
    ADD COLUMN annotation_type TEXT NOT NULL DEFAULT 'highlight',
    ADD COLUMN color TEXT NOT NULL DEFAULT '#FDE68A',
    ADD COLUMN stroke_width SMALLINT NOT NULL DEFAULT 2,
    ADD COLUMN geometry JSONB,
    ADD COLUMN text_content TEXT;

UPDATE public.toeic_text_annotations SET annotation_type = style WHERE annotation_type = 'highlight';

ALTER TABLE public.toeic_text_annotations
    ADD CONSTRAINT toeic_text_annotations_type_check CHECK (annotation_type IN ('highlight', 'underline', 'pen', 'text', 'sticky', 'rectangle', 'arrow')),
    ADD CONSTRAINT toeic_text_annotations_color_check CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
    ADD CONSTRAINT toeic_text_annotations_stroke_width_check CHECK (stroke_width BETWEEN 1 AND 12),
    ADD CONSTRAINT toeic_text_annotations_geometry_size_check CHECK (geometry IS NULL OR pg_column_size(geometry) <= 12000),
    ADD CONSTRAINT toeic_text_annotations_text_content_check CHECK (text_content IS NULL OR char_length(text_content) <= 500);

CREATE INDEX idx_toeic_text_annotations_type ON public.toeic_text_annotations(user_id, test_id, annotation_type, created_at);

CREATE OR REPLACE FUNCTION public.get_toeic_annotations(p_test_id UUID,p_question_id UUID DEFAULT NULL,p_passage_id UUID DEFAULT NULL) RETURNS JSONB LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_user_id UUID:=auth.uid(); v_result JSONB;
BEGIN
 IF v_user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE='P0001'; END IF;
 IF p_test_id IS NULL OR (p_question_id IS NOT NULL AND p_passage_id IS NOT NULL) THEN RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE='P0001'; END IF;
 IF NOT public.is_toeic_test_published(p_test_id) THEN RAISE EXCEPTION 'TEST_NOT_FOUND' USING ERRCODE='P0001'; END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
   'id',a.id,'testId',a.test_id,'questionId',a.question_id,'passageId',a.passage_id,
   'documentIndex',a.document_index,'startOffset',a.start_offset,'endOffset',a.end_offset,
   'quote',a.quote,'style',a.style,'annotationType',a.annotation_type,'color',a.color,
   'strokeWidth',a.stroke_width,'geometry',a.geometry,'textContent',a.text_content,
   'comment',a.comment,'createdAt',a.created_at,'updatedAt',a.updated_at
 ) ORDER BY a.created_at),'[]'::JSONB) INTO v_result
 FROM public.toeic_text_annotations a
 WHERE a.user_id=v_user_id AND a.test_id=p_test_id
   AND (p_question_id IS NULL OR a.question_id=p_question_id)
   AND (p_passage_id IS NULL OR a.passage_id=p_passage_id);
 RETURN v_result;
END; $$;

CREATE OR REPLACE FUNCTION public.create_toeic_annotation(p_test_id UUID,p_question_id UUID,p_passage_id UUID,p_document_index INTEGER,p_start_offset INTEGER,p_end_offset INTEGER,p_quote TEXT,p_style TEXT,p_comment TEXT DEFAULT NULL) RETURNS JSONB LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_user_id UUID:=auth.uid(); v_annotation public.toeic_text_annotations%ROWTYPE;
BEGIN
 IF v_user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE='P0001'; END IF;
 IF p_test_id IS NULL OR (p_question_id IS NULL AND p_passage_id IS NULL) OR (p_question_id IS NOT NULL AND p_passage_id IS NOT NULL) OR p_start_offset IS NULL OR p_end_offset IS NULL OR p_start_offset<0 OR p_end_offset<=p_start_offset OR char_length(btrim(COALESCE(p_quote,''))) NOT BETWEEN 1 AND 1000 OR p_style NOT IN('highlight','underline') OR (p_passage_id IS NOT NULL AND (p_document_index IS NULL OR p_document_index<0)) OR (p_question_id IS NOT NULL AND p_document_index IS NOT NULL) OR (p_comment IS NOT NULL AND char_length(p_comment)>500) THEN RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE='P0001'; END IF;
 IF NOT public.is_toeic_test_published(p_test_id) THEN RAISE EXCEPTION 'TEST_NOT_FOUND' USING ERRCODE='P0001'; END IF;
 IF p_question_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.toeic_questions q WHERE q.id=p_question_id AND q.test_id=p_test_id) THEN RAISE EXCEPTION 'TARGET_NOT_FOUND' USING ERRCODE='P0001'; END IF;
 IF p_passage_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.toeic_passages p WHERE p.id=p_passage_id AND p.test_id=p_test_id) THEN RAISE EXCEPTION 'TARGET_NOT_FOUND' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.toeic_text_annotations(user_id,test_id,question_id,passage_id,document_index,start_offset,end_offset,quote,style,annotation_type,color,stroke_width,comment)
 VALUES(v_user_id,p_test_id,p_question_id,p_passage_id,p_document_index,p_start_offset,p_end_offset,btrim(p_quote),p_style,p_style,CASE WHEN p_style='underline' THEN '#F472B6' ELSE '#FDE68A' END,2,NULLIF(btrim(p_comment),'')) RETURNING * INTO v_annotation;
 RETURN jsonb_build_object('id',v_annotation.id,'testId',v_annotation.test_id,'questionId',v_annotation.question_id,'passageId',v_annotation.passage_id,'documentIndex',v_annotation.document_index,'startOffset',v_annotation.start_offset,'endOffset',v_annotation.end_offset,'quote',v_annotation.quote,'style',v_annotation.style,'annotationType',v_annotation.annotation_type,'color',v_annotation.color,'strokeWidth',v_annotation.stroke_width,'geometry',v_annotation.geometry,'textContent',v_annotation.text_content,'comment',v_annotation.comment,'createdAt',v_annotation.created_at,'updatedAt',v_annotation.updated_at);
END; $$;

CREATE OR REPLACE FUNCTION public.create_toeic_annotator_annotation(
 p_test_id UUID,p_question_id UUID,p_passage_id UUID,p_document_index INTEGER,
 p_start_offset INTEGER,p_end_offset INTEGER,p_quote TEXT,p_annotation_type TEXT,
 p_color TEXT,p_stroke_width SMALLINT,p_geometry JSONB,p_text_content TEXT DEFAULT NULL,p_comment TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_user_id UUID:=auth.uid(); v_annotation public.toeic_text_annotations%ROWTYPE; v_kind TEXT;
BEGIN
 IF v_user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE='P0001'; END IF;
 IF p_test_id IS NULL OR (p_question_id IS NULL AND p_passage_id IS NULL) OR (p_question_id IS NOT NULL AND p_passage_id IS NOT NULL) OR p_annotation_type NOT IN ('highlight','underline','pen','text','sticky','rectangle','arrow') OR p_color !~ '^#[0-9A-Fa-f]{6}$' OR p_stroke_width NOT BETWEEN 1 AND 12 OR (p_passage_id IS NOT NULL AND (p_document_index IS NULL OR p_document_index<0)) OR (p_question_id IS NOT NULL AND p_document_index IS NOT NULL) OR (p_comment IS NOT NULL AND char_length(p_comment)>500) OR (p_text_content IS NOT NULL AND char_length(p_text_content)>500) THEN RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE='P0001'; END IF;
 IF NOT public.is_toeic_test_published(p_test_id) THEN RAISE EXCEPTION 'TEST_NOT_FOUND' USING ERRCODE='P0001'; END IF;
 IF p_question_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.toeic_questions q WHERE q.id=p_question_id AND q.test_id=p_test_id) THEN RAISE EXCEPTION 'TARGET_NOT_FOUND' USING ERRCODE='P0001'; END IF;
 IF p_passage_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.toeic_passages p WHERE p.id=p_passage_id AND p.test_id=p_test_id) THEN RAISE EXCEPTION 'TARGET_NOT_FOUND' USING ERRCODE='P0001'; END IF;
 IF p_annotation_type IN ('highlight','underline') THEN
   IF p_start_offset IS NULL OR p_end_offset IS NULL OR p_start_offset<0 OR p_end_offset<=p_start_offset OR char_length(btrim(COALESCE(p_quote,''))) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE='P0001'; END IF;
   IF p_geometry IS NOT NULL OR p_text_content IS NOT NULL THEN RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE='P0001'; END IF;
 ELSE
   IF p_geometry IS NULL OR jsonb_typeof(p_geometry) <> 'object' OR p_start_offset IS NULL OR p_end_offset IS NULL OR p_start_offset<0 OR p_end_offset<=p_start_offset OR p_quote IS NULL THEN RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE='P0001'; END IF;
   v_kind := p_geometry->>'kind';
   IF (p_annotation_type='pen' AND v_kind <> 'freehand') OR (p_annotation_type IN ('text','sticky','rectangle') AND v_kind <> 'box') OR (p_annotation_type='arrow' AND v_kind <> 'arrow') THEN RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE='P0001'; END IF;
   IF v_kind='freehand' THEN
     IF jsonb_typeof(p_geometry->'points') <> 'array' OR jsonb_array_length(p_geometry->'points') NOT BETWEEN 2 AND 500 THEN RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE='P0001'; END IF;
     IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_geometry->'points') point WHERE jsonb_typeof(point) <> 'object' OR jsonb_typeof(point->'x') <> 'number' OR jsonb_typeof(point->'y') <> 'number' OR (point->>'x')::numeric NOT BETWEEN 0 AND 1 OR (point->>'y')::numeric NOT BETWEEN 0 AND 1) THEN RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE='P0001'; END IF;
   ELSIF v_kind='box' THEN
     IF jsonb_typeof(p_geometry->'x') <> 'number' OR jsonb_typeof(p_geometry->'y') <> 'number' OR jsonb_typeof(p_geometry->'width') <> 'number' OR jsonb_typeof(p_geometry->'height') <> 'number' OR (p_geometry->>'x')::numeric NOT BETWEEN 0 AND 1 OR (p_geometry->>'y')::numeric NOT BETWEEN 0 AND 1 OR (p_geometry->>'width')::numeric NOT BETWEEN 0 AND 1 OR (p_geometry->>'height')::numeric NOT BETWEEN 0 AND 1 OR (p_geometry->>'width')::numeric <= 0 OR (p_geometry->>'height')::numeric <= 0 OR (p_geometry->>'x')::numeric+(p_geometry->>'width')::numeric>1 OR (p_geometry->>'y')::numeric+(p_geometry->>'height')::numeric>1 THEN RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE='P0001'; END IF;
   ELSE
     IF jsonb_typeof(p_geometry->'x1') <> 'number' OR jsonb_typeof(p_geometry->'y1') <> 'number' OR jsonb_typeof(p_geometry->'x2') <> 'number' OR jsonb_typeof(p_geometry->'y2') <> 'number' OR (p_geometry->>'x1')::numeric NOT BETWEEN 0 AND 1 OR (p_geometry->>'y1')::numeric NOT BETWEEN 0 AND 1 OR (p_geometry->>'x2')::numeric NOT BETWEEN 0 AND 1 OR (p_geometry->>'y2')::numeric NOT BETWEEN 0 AND 1 THEN RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE='P0001'; END IF;
   END IF;
   IF p_annotation_type IN ('text','sticky') AND char_length(btrim(COALESCE(p_text_content,''))) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE='P0001'; END IF;
 END IF;
 INSERT INTO public.toeic_text_annotations(user_id,test_id,question_id,passage_id,document_index,start_offset,end_offset,quote,style,annotation_type,color,stroke_width,geometry,text_content,comment)
 VALUES(v_user_id,p_test_id,p_question_id,p_passage_id,p_document_index,p_start_offset,p_end_offset,CASE WHEN p_annotation_type IN ('highlight','underline') THEN btrim(p_quote) ELSE '[annotation]' END,CASE WHEN p_annotation_type='underline' THEN 'underline' ELSE 'highlight' END,p_annotation_type,p_color,p_stroke_width,p_geometry,NULLIF(btrim(p_text_content),''),NULLIF(btrim(p_comment),'')) RETURNING * INTO v_annotation;
 RETURN jsonb_build_object('id',v_annotation.id,'testId',v_annotation.test_id,'questionId',v_annotation.question_id,'passageId',v_annotation.passage_id,'documentIndex',v_annotation.document_index,'startOffset',v_annotation.start_offset,'endOffset',v_annotation.end_offset,'quote',v_annotation.quote,'style',v_annotation.style,'annotationType',v_annotation.annotation_type,'color',v_annotation.color,'strokeWidth',v_annotation.stroke_width,'geometry',v_annotation.geometry,'textContent',v_annotation.text_content,'comment',v_annotation.comment,'createdAt',v_annotation.created_at,'updatedAt',v_annotation.updated_at);
END; $$;

REVOKE ALL ON FUNCTION public.create_toeic_annotator_annotation(UUID,UUID,UUID,INTEGER,INTEGER,INTEGER,TEXT,TEXT,TEXT,SMALLINT,JSONB,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_toeic_annotator_annotation(UUID,UUID,UUID,INTEGER,INTEGER,INTEGER,TEXT,TEXT,TEXT,SMALLINT,JSONB,TEXT,TEXT) TO authenticated;
