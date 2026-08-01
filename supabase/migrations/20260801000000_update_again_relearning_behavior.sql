-- =====================================================================
-- VOCABTOEIC - PHASE 6: UPDATE AGAIN RELEARNING BEHAVIOR
-- Migration Version: 20260801_000000
-- Purpose: Change Again from 1-minute scheduling to queue-based relearning
-- Scope: Update submit_vocabulary_rating RPC function
-- =====================================================================

-- =====================================================================
-- SECTION 1: UPDATE SUBMIT_VOCABULARY_RATING RPC
-- =====================================================================

-- Replace existing function with updated Again behavior
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
    v_vocabulary RECORD;
    v_current_progress RECORD;
    v_new_interval_hours NUMERIC;
    v_next_review_at TIMESTAMPTZ;
    v_new_status TEXT;
    v_new_again_count INT;
    v_reviewed_at TIMESTAMPTZ;
    v_previous_interval_hours NUMERIC;
BEGIN
    -- 1. Get authenticated user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- 2. Create authoritative timestamp
    v_reviewed_at := clock_timestamp();

    -- 3. Check idempotency (if already processed, return existing result)
    IF EXISTS (
        SELECT 1
        FROM public.review_logs
        WHERE user_id = v_user_id
          AND idempotency_key = p_idempotency_key
    ) THEN
        -- Return the existing log result
        RETURN (
            SELECT json_build_object(
                'status', 'already_processed',
                'next_review_at', next_review_at,
                'interval_hours', new_interval_hours,
                'new_status', CASE
                    WHEN next_review_at IS NULL THEN 'mastered'
                    ELSE 'learning'
                END,
                'again_count', (
                    SELECT again_count
                    FROM public.user_vocab_progress
                    WHERE user_id = v_user_id
                      AND vocabulary_id = p_vocabulary_id
                ),
                'review_count', (
                    SELECT review_count
                    FROM public.user_vocab_progress
                    WHERE user_id = v_user_id
                      AND vocabulary_id = p_vocabulary_id
                )
            )
            FROM public.review_logs
            WHERE user_id = v_user_id
              AND idempotency_key = p_idempotency_key
            LIMIT 1
        );
    END IF;

    -- 4. Validate rating
    IF p_rating NOT IN ('again', 'hard', 'good', 'easy', 'mastered') THEN
        RAISE EXCEPTION 'Invalid rating: %. Must be one of: again, hard, good, easy, mastered', p_rating;
    END IF;

    -- 5. Verify vocabulary exists and belongs to user
    SELECT * INTO v_vocabulary
    FROM public.vocabularies
    WHERE id = p_vocabulary_id
      AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Vocabulary not found or access denied';
    END IF;

    -- 6. Get current progress (if exists)
    SELECT * INTO v_current_progress
    FROM public.user_vocab_progress
    WHERE user_id = v_user_id
      AND vocabulary_id = p_vocabulary_id;

    -- Store previous interval for audit log
    v_previous_interval_hours := COALESCE(v_current_progress.interval_hours, 0);

    -- 7. Calculate new interval using APPROVED ALGORITHM
    -- Phase 6: Again behavior changed to queue-based relearning

    IF p_rating = 'mastered' THEN
        -- Mastered: no next review
        v_new_interval_hours := COALESCE(v_current_progress.interval_hours, 0);
        v_next_review_at := NULL;
        v_new_status := 'mastered';
        v_new_again_count := COALESCE(v_current_progress.again_count, 0);

    ELSIF p_rating = 'again' THEN
        -- Phase 6: Again resets interval to 0 (queue-based relearning)
        -- Card reappears after 5 other cards in active study session
        -- NOT immediately due in global review queue
        v_new_interval_hours := 0;
        v_next_review_at := NULL;  -- Not scheduled globally, handled by session queue
        v_new_status := 'learning';
        v_new_again_count := COALESCE(v_current_progress.again_count, 0) + 1;

    ELSIF p_rating = 'hard' THEN
        -- Hard: initial 6 hours or ×2 current interval
        IF COALESCE(v_current_progress.interval_hours, 0) > 0 THEN
            v_new_interval_hours := v_current_progress.interval_hours * 2;
        ELSE
            v_new_interval_hours := 6;
        END IF;
        v_next_review_at := v_reviewed_at + (v_new_interval_hours || ' hours')::INTERVAL;
        v_new_status := 'learning';
        v_new_again_count := COALESCE(v_current_progress.again_count, 0);

    ELSIF p_rating = 'good' THEN
        -- Good: initial 24 hours or ×3 current interval
        IF COALESCE(v_current_progress.interval_hours, 0) > 0 THEN
            v_new_interval_hours := v_current_progress.interval_hours * 3;
        ELSE
            v_new_interval_hours := 24;
        END IF;
        v_next_review_at := v_reviewed_at + (v_new_interval_hours || ' hours')::INTERVAL;
        v_new_status := 'learning';
        v_new_again_count := COALESCE(v_current_progress.again_count, 0);

    ELSIF p_rating = 'easy' THEN
        -- Easy: initial 72 hours or ×4 current interval
        IF COALESCE(v_current_progress.interval_hours, 0) > 0 THEN
            v_new_interval_hours := v_current_progress.interval_hours * 4;
        ELSE
            v_new_interval_hours := 72;
        END IF;
        v_next_review_at := v_reviewed_at + (v_new_interval_hours || ' hours')::INTERVAL;
        v_new_status := 'learning';
        v_new_again_count := COALESCE(v_current_progress.again_count, 0);
    END IF;

    -- 8. Atomic update: progress + review log in single transaction
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

    -- 9. Insert review log (audit trail)
    INSERT INTO public.review_logs (
        user_id,
        vocabulary_id,
        rating,
        previous_interval_hours,
        new_interval_hours,
        next_review_at,
        reviewed_at,
        idempotency_key
    )
    VALUES (
        v_user_id,
        p_vocabulary_id,
        p_rating,
        v_previous_interval_hours,
        v_new_interval_hours,
        v_next_review_at,
        v_reviewed_at,
        p_idempotency_key
    );

    -- 10. Return success with calculated values
    RETURN json_build_object(
        'status', 'success',
        'next_review_at', v_next_review_at,
        'interval_hours', v_new_interval_hours,
        'new_status', v_new_status,
        'again_count', v_new_again_count,
        'review_count', COALESCE(v_current_progress.review_count, 0) + 1
    );
END;
$$;

-- =====================================================================
-- SECTION 2: GRANT EXECUTE PERMISSION
-- =====================================================================

-- Ensure authenticated users can execute the updated RPC
GRANT EXECUTE ON FUNCTION public.submit_vocabulary_rating(UUID, TEXT, UUID)
TO authenticated;

-- =====================================================================
-- SECTION 3: MIGRATION NOTES
-- =====================================================================

-- Phase 6 Changes:
-- 1. Again rating now sets interval_hours = 0 (was 1/60)
-- 2. Again rating now sets next_review_at = NULL (was now + 1 minute)
-- 3. Card relearning managed by client-side session queue
-- 4. Card reappears after 5 other cards in active study session
-- 5. Card does NOT become immediately due in global review queue
-- 6. Hard/Good/Easy/Mastered behaviors unchanged
-- 7. Review history (review_count, again_count, review_logs) preserved
-- 8. Atomic transaction and idempotency protection preserved
-- 9. RLS enforcement and server-side timestamp authority preserved
