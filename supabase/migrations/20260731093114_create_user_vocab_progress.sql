-- =====================================================================
-- VOCABTOEIC - PHASE 5: USER VOCABULARY PROGRESS TABLE
-- Migration Version: 20260731_093114
-- Purpose: Persist SRS progress in Supabase with atomic RPC support
-- Scope: user_vocab_progress table, indexes, RLS policies
-- =====================================================================

-- =====================================================================
-- SECTION 1: USER_VOCAB_PROGRESS TABLE
-- =====================================================================

ALTER TABLE public.vocabularies
    ADD CONSTRAINT vocabularies_id_user_id_unique
    UNIQUE (id, user_id);

CREATE TABLE public.user_vocab_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,
    vocabulary_id UUID NOT NULL,

    status TEXT NOT NULL DEFAULT 'new'
        CHECK (status IN ('new', 'learning', 'mastered')),

    interval_hours NUMERIC(10, 4) NOT NULL DEFAULT 0
        CHECK (interval_hours >= 0),

    review_count INT NOT NULL DEFAULT 0
        CHECK (review_count >= 0),

    again_count INT NOT NULL DEFAULT 0
        CHECK (again_count >= 0),

    last_reviewed_at TIMESTAMPTZ,
    next_review_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT user_vocab_progress_user_fk
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    CONSTRAINT user_vocab_progress_vocab_owner_fk
        FOREIGN KEY (vocabulary_id, user_id)
        REFERENCES public.vocabularies(id, user_id)
        ON DELETE CASCADE,

    CONSTRAINT user_vocab_progress_unique
        UNIQUE (user_id, vocabulary_id)
);

-- =====================================================================
-- SECTION 2: INDEXES
-- =====================================================================

CREATE INDEX idx_user_vocab_progress_user_id
    ON public.user_vocab_progress(user_id);

CREATE INDEX idx_user_vocab_progress_vocabulary_id
    ON public.user_vocab_progress(vocabulary_id);

CREATE INDEX idx_user_vocab_progress_next_review
    ON public.user_vocab_progress(user_id, next_review_at)
    WHERE status != 'mastered' AND next_review_at IS NOT NULL;

CREATE INDEX idx_user_vocab_progress_status
    ON public.user_vocab_progress(user_id, status);

-- =====================================================================
-- SECTION 3: UPDATED_AT TRIGGER
-- =====================================================================

CREATE TRIGGER set_updated_at_user_vocab_progress
    BEFORE UPDATE ON public.user_vocab_progress
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- SECTION 4: TABLE COMMENTS
-- =====================================================================

COMMENT ON TABLE public.user_vocab_progress
IS 'Phase 5: User SRS progress per vocabulary. One row per user-vocabulary pair. Updated atomically via submit_vocabulary_rating RPC.';

COMMENT ON COLUMN public.user_vocab_progress.user_id
IS 'Owner of this progress record. Must match vocabulary owner.';

COMMENT ON COLUMN public.user_vocab_progress.vocabulary_id
IS 'Vocabulary being tracked. Must belong to same user.';

COMMENT ON COLUMN public.user_vocab_progress.status
IS 'Learning state: new (never studied), learning (in review cycle), mastered (manually marked complete).';

COMMENT ON COLUMN public.user_vocab_progress.interval_hours
IS 'Current SRS interval in hours. Exact value: 1/60 for Again (1 minute), 6+ for Hard/Good/Easy.';

COMMENT ON COLUMN public.user_vocab_progress.review_count
IS 'Total number of times user has reviewed this vocabulary.';

COMMENT ON COLUMN public.user_vocab_progress.again_count
IS 'Number of times user rated this vocabulary as Again (forgot).';

COMMENT ON COLUMN public.user_vocab_progress.last_reviewed_at
IS 'Database timestamp of most recent review submission.';

COMMENT ON COLUMN public.user_vocab_progress.next_review_at
IS 'Calculated next review time. NULL if status is mastered.';
