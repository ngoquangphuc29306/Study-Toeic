-- =====================================================================
-- VOCABTOEIC - HARDEN RATING IDEMPOTENCY CONTRACT
-- Migration Version: 20260804_000000
-- Scope: Idempotency payload validation, result snapshots, race safety
-- =====================================================================

-- Existing review logs do not contain enough information to reconstruct the
-- exact original progress result after later ratings. Keep legacy rows intact
-- and leave these snapshot columns NULL for them. New RPC writes populate all
-- three columns atomically with the review log.
ALTER TABLE public.review_logs
    ADD COLUMN IF NOT EXISTS result_new_status TEXT,
    ADD COLUMN IF NOT EXISTS result_review_count INTEGER,
    ADD COLUMN IF NOT EXISTS result_again_count INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'review_logs_result_new_status_check'
          AND conrelid = 'public.review_logs'::regclass
    ) THEN
        ALTER TABLE public.review_logs
            ADD CONSTRAINT review_logs_result_new_status_check
            CHECK (
                result_new_status IS NULL
                OR result_new_status IN ('new', 'learning', 'mastered')
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'review_logs_result_review_count_check'
          AND conrelid = 'public.review_logs'::regclass
    ) THEN
        ALTER TABLE public.review_logs
            ADD CONSTRAINT review_logs_result_review_count_check
            CHECK (
                result_review_count IS NULL
                OR result_review_count >= 1
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'review_logs_result_again_count_check'
          AND conrelid = 'public.review_logs'::regclass
    ) THEN
        ALTER TABLE public.review_logs
            ADD CONSTRAINT review_logs_result_again_count_check
            CHECK (
                result_again_count IS NULL
                OR result_again_count >= 0
            );
    END IF;
END $$;

COMMENT ON COLUMN public.review_logs.result_new_status
IS 'Exact new status returned by submit_vocabulary_rating for this review log. NULL means a legacy row predating result snapshots.';

COMMENT ON COLUMN public.review_logs.result_review_count
IS 'Exact review_count returned by submit_vocabulary_rating for this review log. NULL means a legacy row predating result snapshots.';

COMMENT ON COLUMN public.review_logs.result_again_count
IS 'Exact again_count returned by submit_vocabulary_rating for this review log. NULL means a legacy row predating result snapshots.';

CREATE OR REPLACE FUNCTION public.submit_vocabulary_rating(
    p_vocabulary_id UUID,
    p_rating TEXT,
    p_idempotency_key UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_current_progress RECORD;
    v_existing_log RECORD;
    v_new_interval_hours NUMERIC;
    v_next_review_at TIMESTAMPTZ;
    v_new_status TEXT;
    v_new_again_count INT;
    v_result_review_count INT;
    v_reviewed_at TIMESTAMPTZ;
    v_previous_interval_hours NUMERIC;
BEGIN
    -- 1. Get authenticated user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_idempotency_key IS NULL THEN
        RAISE EXCEPTION 'Idempotency key is required';
    END IF;

    -- 2. Serialize all requests for this user/key pair for the duration of
    -- this transaction. The lock is released automatically on commit/rollback.
    -- Only one advisory lock is acquired, so this path has no lock-order cycle.
    PERFORM pg_advisory_xact_lock(
        hashtextextended(v_user_id::TEXT || ':' || p_idempotency_key::TEXT, 0)
    );

    -- 3. Check idempotency after the lock is held.
    SELECT * INTO v_existing_log
    FROM public.review_logs
    WHERE user_id = v_user_id
      AND idempotency_key = p_idempotency_key
    LIMIT 1;

    IF FOUND THEN
        -- Reusing a key with a different payload is a caller error. Do not
        -- expose the original row or apply any progress mutation.
        IF v_existing_log.vocabulary_id IS DISTINCT FROM p_vocabulary_id
           OR v_existing_log.rating IS DISTINCT FROM p_rating THEN
            RETURN json_build_object(
                'status', 'idempotency_conflict',
                'message', 'The idempotency key was already used with a different rating payload.'
            );
        END IF;

        -- Legacy rows cannot safely reconstruct review_count/again_count or
        -- status after later ratings. Return an explicit non-success status;
        -- never infer mastered from a NULL next_review_at.
        IF v_existing_log.result_new_status IS NULL
           OR v_existing_log.result_review_count IS NULL
           OR v_existing_log.result_again_count IS NULL THEN
            RETURN json_build_object(
                'status', 'legacy_result_unavailable',
                'message', 'This idempotency record predates the stored rating result snapshot.'
            );
        END IF;

        RETURN json_build_object(
            'status', 'already_processed',
            'vocabulary_id', v_existing_log.vocabulary_id,
            'rating', v_existing_log.rating,
            'new_status', v_existing_log.result_new_status,
            'next_review_at', v_existing_log.next_review_at,
            'interval_hours', v_existing_log.new_interval_hours,
            'review_count', v_existing_log.result_review_count,
            'again_count', v_existing_log.result_again_count
        );
    END IF;

    -- 4. Validate new payload
    IF p_rating NOT IN ('again', 'hard', 'good', 'easy', 'mastered') THEN
        RAISE EXCEPTION 'Invalid rating: %. Must be one of: again, hard, good, easy, mastered', p_rating;
    END IF;

    -- 5. Create authoritative timestamp
    v_reviewed_at := clock_timestamp();

    -- 6. Verify vocabulary exists and belongs to user
    PERFORM 1
    FROM public.vocabularies
    WHERE id = p_vocabulary_id
        AND user_id = v_user_id;

    IF NOT FOUND THEN
    RAISE EXCEPTION 'Vocabulary not found or access denied';
    END IF;

    -- 7. Get current progress (if exists)
    SELECT * INTO v_current_progress
    FROM public.user_vocab_progress
    WHERE user_id = v_user_id
      AND vocabulary_id = p_vocabulary_id;

    v_previous_interval_hours := COALESCE(v_current_progress.interval_hours, 0);

    -- 8. Calculate new interval using the existing approved algorithm.
    -- This block intentionally matches the previous RPC byte-for-byte in
    -- behavior; only idempotency and result persistence are hardened.
    IF p_rating = 'mastered' THEN
        v_new_interval_hours := COALESCE(v_current_progress.interval_hours, 0);
        v_next_review_at := NULL;
        v_new_status := 'mastered';
        v_new_again_count := COALESCE(v_current_progress.again_count, 0);

    ELSIF p_rating = 'again' THEN
        v_new_interval_hours := 0;
        v_next_review_at := NULL;
        v_new_status := 'learning';
        v_new_again_count := COALESCE(v_current_progress.again_count, 0) + 1;

    ELSIF p_rating = 'hard' THEN
        IF COALESCE(v_current_progress.interval_hours, 0) > 0 THEN
            v_new_interval_hours := v_current_progress.interval_hours * 2;
        ELSE
            v_new_interval_hours := 6;
        END IF;
        v_next_review_at := v_reviewed_at + (v_new_interval_hours || ' hours')::INTERVAL;
        v_new_status := 'learning';
        v_new_again_count := COALESCE(v_current_progress.again_count, 0);

    ELSIF p_rating = 'good' THEN
        IF COALESCE(v_current_progress.interval_hours, 0) > 0 THEN
            v_new_interval_hours := v_current_progress.interval_hours * 3;
        ELSE
            v_new_interval_hours := 24;
        END IF;
        v_next_review_at := v_reviewed_at + (v_new_interval_hours || ' hours')::INTERVAL;
        v_new_status := 'learning';
        v_new_again_count := COALESCE(v_current_progress.again_count, 0);

    ELSIF p_rating = 'easy' THEN
        IF COALESCE(v_current_progress.interval_hours, 0) > 0 THEN
            v_new_interval_hours := v_current_progress.interval_hours * 4;
        ELSE
            v_new_interval_hours := 72;
        END IF;
        v_next_review_at := v_reviewed_at + (v_new_interval_hours || ' hours')::INTERVAL;
        v_new_status := 'learning';
        v_new_again_count := COALESCE(v_current_progress.again_count, 0);
    END IF;

    v_result_review_count := COALESCE(v_current_progress.review_count, 0) + 1;

    -- 9. Atomic progress update + review log with result snapshot
    INSERT INTO public.user_vocab_progress (
        user_id,
        vocabulary_id,
        status,
        review_count,
        last_reviewed_at,
        next_review_at,
        interval_hours,
        again_count
    )
    VALUES (
        v_user_id,
        p_vocabulary_id,
        v_new_status,
        1,
        v_reviewed_at,
        v_next_review_at,
        v_new_interval_hours,
        v_new_again_count
    )
    ON CONFLICT (user_id, vocabulary_id) DO UPDATE SET
        status = v_new_status,
        review_count = public.user_vocab_progress.review_count + 1,
        last_reviewed_at = v_reviewed_at,
        next_review_at = v_next_review_at,
        interval_hours = v_new_interval_hours,
        again_count = v_new_again_count,
        updated_at = clock_timestamp();

    INSERT INTO public.review_logs (
        user_id,
        vocabulary_id,
        rating,
        previous_interval_hours,
        new_interval_hours,
        next_review_at,
        reviewed_at,
        idempotency_key,
        result_new_status,
        result_review_count,
        result_again_count
    )
    VALUES (
        v_user_id,
        p_vocabulary_id,
        p_rating,
        v_previous_interval_hours,
        v_new_interval_hours,
        v_next_review_at,
        v_reviewed_at,
        p_idempotency_key,
        v_new_status,
        v_result_review_count,
        v_new_again_count
    );

    RETURN json_build_object(
        'status', 'success',
        'vocabulary_id', p_vocabulary_id,
        'rating', p_rating,
        'new_status', v_new_status,
        'next_review_at', v_next_review_at,
        'interval_hours', v_new_interval_hours,
        'review_count', v_result_review_count,
        'again_count', v_new_again_count
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_vocabulary_rating(UUID, TEXT, UUID)
TO authenticated;

COMMENT ON FUNCTION public.submit_vocabulary_rating(UUID, TEXT, UUID)
IS 'Atomic SRS rating RPC. Uses a transaction advisory lock for user/idempotency_key, rejects payload reuse conflicts, stores exact result snapshots, and returns the original snapshot for already_processed retries. SRS algorithm and server timestamps remain unchanged.';
