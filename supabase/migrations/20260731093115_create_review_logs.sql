-- =====================================================================
-- VOCABTOEIC - PHASE 5: REVIEW LOGS TABLE
-- Migration Version: 20260731_093115
-- Purpose: Audit trail for every rating action with idempotency
-- Scope: review_logs table, indexes, RLS policies
-- =====================================================================

-- =====================================================================
-- SECTION 1: REVIEW_LOGS TABLE
-- =====================================================================

CREATE TABLE public.review_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,
    vocabulary_id UUID NOT NULL,

    rating TEXT NOT NULL
        CHECK (rating IN ('again', 'hard', 'good', 'easy', 'mastered')),

    previous_interval_hours NUMERIC(10, 4) NOT NULL
        CHECK (previous_interval_hours >= 0),

    new_interval_hours NUMERIC(10, 4) NOT NULL
        CHECK (new_interval_hours >= 0),

    next_review_at TIMESTAMPTZ,

    reviewed_at TIMESTAMPTZ NOT NULL,

    idempotency_key UUID NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT review_logs_user_fk
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    CONSTRAINT review_logs_vocabulary_fk
        FOREIGN KEY (vocabulary_id)
        REFERENCES public.vocabularies(id)
        ON DELETE CASCADE,

    CONSTRAINT review_logs_idempotency_unique
        UNIQUE (user_id, idempotency_key)
);

-- =====================================================================
-- SECTION 2: INDEXES
-- =====================================================================

CREATE INDEX idx_review_logs_user_id
    ON public.review_logs(user_id);

CREATE INDEX idx_review_logs_vocabulary_id
    ON public.review_logs(vocabulary_id);

CREATE INDEX idx_review_logs_user_vocab
    ON public.review_logs(user_id, vocabulary_id, reviewed_at DESC);

CREATE INDEX idx_review_logs_reviewed_at
    ON public.review_logs(user_id, reviewed_at DESC);

CREATE INDEX idx_review_logs_idempotency
    ON public.review_logs(idempotency_key);

-- =====================================================================
-- SECTION 3: TABLE COMMENTS
-- =====================================================================

COMMENT ON TABLE public.review_logs
IS 'Phase 5: Immutable audit trail of every rating submission. Inserted only via submit_vocabulary_rating RPC. Prevents client manipulation of scheduling algorithm.';

COMMENT ON COLUMN public.review_logs.user_id
IS 'User who submitted this rating. Must match vocabulary owner.';

COMMENT ON COLUMN public.review_logs.vocabulary_id
IS 'Vocabulary that was reviewed.';

COMMENT ON COLUMN public.review_logs.rating
IS 'User rating: again (forgot), hard (difficult), good (remembered), easy (too easy), mastered (mark complete).';

COMMENT ON COLUMN public.review_logs.previous_interval_hours
IS 'Interval before this rating. Server-calculated from current progress, NOT from browser.';

COMMENT ON COLUMN public.review_logs.new_interval_hours
IS 'Interval after this rating. Server-calculated by approved SRS algorithm, NOT from browser.';

COMMENT ON COLUMN public.review_logs.next_review_at
IS 'Calculated next review timestamp. Server-calculated, NOT from browser.';

COMMENT ON COLUMN public.review_logs.reviewed_at
IS 'Authoritative server timestamp when rating was processed. NOT from browser.';

COMMENT ON COLUMN public.review_logs.idempotency_key
IS 'Client-generated UUID for duplicate detection. Same key within 24h returns existing result without re-applying rating.';
