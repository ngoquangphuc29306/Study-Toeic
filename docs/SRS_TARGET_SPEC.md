# VocabTOEIC — SRS Target Specification

**Document Version**: 2.0  
**Created**: 2026-07-30  
**Updated**: 2026-07-30  
**Status**: Product Owner Approved  
**Authority**: Defines approved SRS algorithm and safety requirements

---

## 1. Current SRS Implementation (Verified)

### 1.1. Source Code
**File**: `services/vocabService.ts` (lines 557-656)

**Function**: `updateUserProgress(vocabId, status, rating?)`

### 1.2. Current Card States

**Type**: `LearningStatus` (from `lib/types.ts`)

```typescript
type LearningStatus = 'new' | 'learning' | 'mastered';
```

**State Definitions**:
- `'new'`: Never studied, or newly added
- `'learning'`: Studied at least once, in review cycle
- `'mastered'`: Manually marked as learned, no further reviews scheduled

### 1.3. Current Ratings

**Type**: `SrsRating` (from `services/vocabService.ts`)

```typescript
type SrsRating = 'again' | 'hard' | 'good' | 'easy' | 'mastered';
```

**Rating Definitions**:
1. **'again'**: Forgot → Reset to 5 minutes
2. **'hard'**: Difficult → Initial 6 hours or ×2 current interval
3. **'good'**: Good → Initial 24 hours or ×3 current interval
4. **'easy'**: Easy → Initial 72 hours or ×4 current interval
5. **'mastered'**: Fully learned → `status = 'mastered'`, `next_review_at = null`

### 1.4. Current Algorithm (Verified from Code)

**Scheduling Logic**:

```typescript
// From services/vocabService.ts lines 597-619
if (rating === 'again') {
  newStatus = 'learning';
  currentAgainCount += 1;
  newIntervalHours = 0.0833; // 5 minutes
  nextReviewIso = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
}
else if (rating === 'hard') {
  newStatus = 'learning';
  newIntervalHours = currentIntervalHours > 0 ? currentIntervalHours * 2 : 6;
  nextReviewIso = new Date(now.getTime() + newIntervalHours * 3600 * 1000).toISOString();
}
else if (rating === 'good') {
  newStatus = 'learning';
  newIntervalHours = currentIntervalHours > 0 ? currentIntervalHours * 3 : 24;
  nextReviewIso = new Date(now.getTime() + newIntervalHours * 3600 * 1000).toISOString();
}
else if (rating === 'easy') {
  newStatus = 'learning';
  newIntervalHours = currentIntervalHours > 0 ? currentIntervalHours * 4 : 72;
  nextReviewIso = new Date(now.getTime() + newIntervalHours * 3600 * 1000).toISOString();
}
else if (status === 'mastered' || rating === 'mastered') {
  newStatus = 'mastered';
  nextReviewIso = undefined; // No future review
}
```

**Initial Intervals** (when `currentIntervalHours = 0`):
- Again: 5 minutes (0.0833 hours)
- Hard: 6 hours
- Good: 24 hours
- Easy: 72 hours

**Subsequent Intervals** (when `currentIntervalHours > 0`):
- Again: Reset to 5 minutes (ignores previous interval)
- Hard: `currentIntervalHours × 2`
- Good: `currentIntervalHours × 3`
- Easy: `currentIntervalHours × 4`

### 1.5. Current Data Model

**Fields in `UserVocabProgress`** (from `lib/types.ts`):

```typescript
interface UserVocabProgress {
  id?: string;
  user_id?: string;
  vocabulary_id: string;
  status: LearningStatus; // 'new' | 'learning' | 'mastered'
  review_count: number;
  last_reviewed_at: string; // ISO timestamp
  next_review_at: string | null; // ISO timestamp or null if mastered
  interval_hours: number;
  again_count: number;
  mastery_level?: number; // Optional, not currently used
}
```

### 1.6. Current Limitations

**Identified Issues**:
1. **No ease factor**: All cards use same multipliers regardless of difficulty history
2. **No lapse handling**: "Again" only increments `again_count`, no special relearning
3. **No interval cap**: Intervals can grow unbounded (×4 repeatedly → years)
4. **Manual mastery only**: No automatic promotion to mastered state
5. **Timestamp coupling**: Uses `Date.now()` inside scheduling logic (line 562)
6. **Non-atomic updates**: Progress update and review log are separate operations (no transaction)
7. **No idempotency**: Double-submit can create duplicate progress updates

**Note**: These are architectural observations, NOT requirements to change for MVP. Current algorithm is APPROVED for MVP.

---

## 2. Approved MVP Target Algorithm

### 2.1. Algorithm Specification

**Status**: ✅ APPROVED — Preserve current behaviour exactly

**MVP Target**: Keep the current algorithm as-is with the following enhancements for reliability only:

**Behaviour** (unchanged from current):
- Again: 5 minutes
- Hard: initial 6 hours, then ×2
- Good: initial 24 hours, then ×3
- Easy: initial 72 hours, then ×4
- Mastered: manual only, no automatic promotion
- States: `new`, `learning`, `mastered` (no additional states)

**Reliability Enhancements** (approved):
1. Extract pure domain function with explicit timestamp parameter
2. Add idempotency key to prevent duplicate submissions
3. Atomic transaction for progress update + review log insertion
4. Use database RPC/function to enforce server-side scheduling logic

**NOT Approved for MVP**:
- ❌ Add ease_factor field
- ❌ Add relearning steps
- ❌ Add interval cap
- ❌ Add auto-mastery promotion
- ❌ Add `review` or `suspended` states
- ❌ Change multipliers or initial intervals

### 2.2. Approved Schema (MVP)

**Status**: ✅ Fields approved for MVP

```sql
-- PROPOSED: Not migration-ready
CREATE TABLE user_vocab_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  vocabulary_id UUID NOT NULL REFERENCES vocabularies(id),
  status TEXT NOT NULL CHECK (status IN ('new', 'learning', 'mastered')),
  review_count INT NOT NULL DEFAULT 0,
  last_reviewed_at TIMESTAMPTZ,
  next_review_at TIMESTAMPTZ,
  interval_hours NUMERIC NOT NULL DEFAULT 0,
  again_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, vocabulary_id)
);
```

**Note**: `mastery_level` field exists in TypeScript interface but is optional and not actively used. Can be preserved or removed in migration.

### 2.3. Review Logs Schema (MVP)

**Status**: ✅ Approved pattern — RPC-inserted only

```sql
-- PROPOSED: Not migration-ready
CREATE TABLE review_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  vocabulary_id UUID NOT NULL REFERENCES vocabularies(id),
  rating TEXT NOT NULL CHECK (rating IN ('again', 'hard', 'good', 'easy', 'mastered')),
  previous_interval_hours NUMERIC NOT NULL,
  new_interval_hours NUMERIC NOT NULL,
  next_review_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  idempotency_key UUID NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_review_logs_user_vocab 
  ON review_logs(user_id, vocabulary_id, reviewed_at DESC);
```

**Critical**: Browser must NOT insert directly into `review_logs`. Use database function/RPC only.

### 2.4. Atomic Rating RPC (Approved Pattern)

**Status**: ✅ Approved — Required for MVP

```sql
-- PROPOSED: Not migration-ready
CREATE OR REPLACE FUNCTION submit_vocabulary_rating(
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
  v_again_count INT;
  v_reviewed_at TIMESTAMPTZ;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Create authoritative timestamp
  v_reviewed_at := clock_timestamp();

  -- Check idempotency (if this key already processed, return existing result)
  IF EXISTS (SELECT 1 FROM public.review_logs WHERE idempotency_key = p_idempotency_key) THEN
    RETURN json_build_object('status', 'already_processed');
  END IF;

  -- Verify vocabulary exists, belongs to user, and is not deleted
  SELECT * INTO v_vocabulary
  FROM public.vocabularies
  WHERE id = p_vocabulary_id
    AND user_id = v_user_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vocabulary not found or access denied';
  END IF;

  -- Get current progress
  SELECT * INTO v_current_progress
  FROM public.user_vocab_progress
  WHERE user_id = v_user_id AND vocabulary_id = p_vocabulary_id;

  -- Calculate new interval using APPROVED ALGORITHM (current behaviour)
  IF p_rating = 'again' THEN
    v_new_interval_hours := 0.0833; -- 5 minutes
    v_next_review_at := v_reviewed_at + INTERVAL '5 minutes';
    v_new_status := 'learning';
    v_again_count := COALESCE(v_current_progress.again_count, 0) + 1;
  ELSIF p_rating = 'hard' THEN
    IF COALESCE(v_current_progress.interval_hours, 0) > 0 THEN
      v_new_interval_hours := v_current_progress.interval_hours * 2;
    ELSE
      v_new_interval_hours := 6;
    END IF;
    v_next_review_at := v_reviewed_at + (v_new_interval_hours || ' hours')::INTERVAL;
    v_new_status := 'learning';
    v_again_count := COALESCE(v_current_progress.again_count, 0);
  ELSIF p_rating = 'good' THEN
    IF COALESCE(v_current_progress.interval_hours, 0) > 0 THEN
      v_new_interval_hours := v_current_progress.interval_hours * 3;
    ELSE
      v_new_interval_hours := 24;
    END IF;
    v_next_review_at := v_reviewed_at + (v_new_interval_hours || ' hours')::INTERVAL;
    v_new_status := 'learning';
    v_again_count := COALESCE(v_current_progress.again_count, 0);
  ELSIF p_rating = 'easy' THEN
    IF COALESCE(v_current_progress.interval_hours, 0) > 0 THEN
      v_new_interval_hours := v_current_progress.interval_hours * 4;
    ELSE
      v_new_interval_hours := 72;
    END IF;
    v_next_review_at := v_reviewed_at + (v_new_interval_hours || ' hours')::INTERVAL;
    v_new_status := 'learning';
    v_again_count := COALESCE(v_current_progress.again_count, 0);
  ELSIF p_rating = 'mastered' THEN
    v_new_interval_hours := COALESCE(v_current_progress.interval_hours, 0);
    v_next_review_at := NULL;
    v_new_status := 'mastered';
    v_again_count := COALESCE(v_current_progress.again_count, 0);
  ELSE
    RAISE EXCEPTION 'Invalid rating: %', p_rating;
  END IF;

  -- Atomic update: progress + review log in single transaction
  INSERT INTO public.user_vocab_progress (
    user_id, vocabulary_id, status, review_count,
    last_reviewed_at, next_review_at, interval_hours, again_count
  )
  VALUES (
    v_user_id, p_vocabulary_id, v_new_status,
    1, v_reviewed_at, v_next_review_at, v_new_interval_hours, v_again_count
  )
  ON CONFLICT (user_id, vocabulary_id) DO UPDATE SET
    status = v_new_status,
    review_count = public.user_vocab_progress.review_count + 1,
    last_reviewed_at = v_reviewed_at,
    next_review_at = v_next_review_at,
    interval_hours = v_new_interval_hours,
    again_count = v_again_count,
    updated_at = clock_timestamp();

  -- Insert review log
  INSERT INTO public.review_logs (
    user_id, vocabulary_id, rating,
    previous_interval_hours, new_interval_hours, next_review_at,
    reviewed_at, idempotency_key
  )
  VALUES (
    v_user_id, p_vocabulary_id, p_rating,
    COALESCE(v_current_progress.interval_hours, 0), v_new_interval_hours, v_next_review_at,
    v_reviewed_at, p_idempotency_key
  );

  RETURN json_build_object(
    'status', 'success',
    'next_review_at', v_next_review_at,
    'interval_hours', v_new_interval_hours
  );
END;
$$;
    'next_review_at', v_next_review_at,
    'interval_hours', v_new_interval_hours
  );
END;
$$;
```

**Security**: `SECURITY DEFINER` runs with function owner's privileges. RLS policies still apply via `auth.uid()` check.

---

## 3. Safety Requirements (Approved)

### 3.1. Pure Domain Functions

**Requirement**: ✅ APPROVED

SRS scheduling logic must be:
- Pure functions (no side effects)
- Deterministic (same inputs → same outputs)
- Testable in isolation
- No `Date.now()` calls inside domain logic

**Example Signature**:
```typescript
function calculateNextReview(
  rating: SrsRating,
  currentProgress: UserVocabProgress,
  reviewedAt: Date // Explicit timestamp parameter
): {
  nextReviewAt: Date | null;
  intervalHours: number;
  status: LearningStatus;
  againCount: number;
}
```

### 3.2. Idempotency

**Requirement**: ✅ APPROVED

Rating submissions must be idempotent:
- Generate `idempotency_key` (UUID) on client for each rating action
- Server checks if key already processed
- If duplicate, return success without re-applying rating
- Prevents double-submit on network retry or button double-click

**Client Implementation**:
```typescript
const idempotencyKey = crypto.randomUUID();
await supabase.rpc('submit_vocabulary_rating', {
  p_vocabulary_id: vocabId,
  p_rating: rating,
  p_idempotency_key: idempotencyKey
});
```

**Browser sends ONLY**:
- `vocabulary_id` — which word was reviewed
- `rating` — user's choice (again/hard/good/easy/mastered)
- `idempotency_key` — client-generated UUID for deduplication

**Server calculates**:
- `reviewed_at` — authoritative timestamp using `clock_timestamp()`
- `previous_interval_hours` — read from current progress
- `new_interval_hours` — calculated by approved algorithm
- `next_review_at` — calculated by approved algorithm
### 3.3. Atomicity

**Requirement**: ✅ APPROVED

Progress update and review log creation must happen in ONE transaction:
- If progress update fails, review log must not be created
- If review log fails, progress update must rollback
- No partial state (progress updated but no log, or vice versa)

**Implementation**: Database function/RPC wraps both operations in transaction (shown in 2.4).

### 3.4. Server Authority

**Requirement**: ✅ APPROVED

Browser must NOT provide:
Browser must NOT provide:
- `previous_interval_hours` (server reads from DB)
- `new_interval_hours` (server calculates)
- `next_review_at` (server calculates)
- `reviewed_at` (server creates authoritative timestamp)

Browser provides ONLY:
- `vocabulary_id`
- `rating` (user's choice)
- `idempotency_key` (client-generated UUID)

**Rationale**: Prevent client manipulation of scheduling algorithm and audit trail. Server owns all timestamps and calculations.

### 3.5. Test Requirements

**Requirement**: ✅ APPROVED

All SRS domain functions must have:
- Unit tests with fixed timestamps (NOT `new Date()` in assertions)
- Test all rating scenarios (again, hard, good, easy, mastered)
- Test edge cases (first review, very long intervals, multiple "again" in sequence)
- Test idempotency (same key twice)

**Example Test**:
```typescript
test('again rating resets interval to 5 minutes', () => {
  const now = new Date('2026-07-30T10:00:00Z'); // Fixed timestamp
  const progress = {
    interval_hours: 24,
    status: 'learning' as const,
    again_count: 1
  };
  
  const result = calculateNextReview('again', progress, now);
  
  expect(result.intervalHours).toBe(0.0833);
  expect(result.nextReviewAt).toEqual(new Date('2026-07-30T10:05:00Z'));
  expect(result.status).toBe('learning');
  expect(result.againCount).toBe(2);
});
```

**IMPORTANT**: Never use `Date.now()` twice in one test (first to call function, second to assert result). Use fixed timestamps.

---

## 4. Deferred: Algorithm Research

### 4.1. Modified SM-2 (Deferred)

**Status**: 🔮 NOT APPROVED for MVP — Research phase only

**Overview**: Enhanced algorithm with ease factors and lapse handling.

**Changes from Current**:
1. Add `ease_factor` field (1.3 to 2.5)
2. Adjust ease based on rating difficulty
3. Interval calculation: `interval × ease_factor`
4. Lapse handling: "Again" enters relearning steps (10min → 1 day)
5. Auto-mastery: promote to mastered when ease_factor > 2.3 and interval > 90 days
6. Interval cap: max 365 days

**Not Approved**:
- ❌ Do NOT add ease_factor field in MVP schema
- ❌ Do NOT implement relearning steps
- ❌ Do NOT implement auto-mastery
- ❌ Do NOT add interval cap

**Research Tasks** (if approved later):
- Literature review of SM-2 variants
- A/B testing plan
- User feedback collection
- Migration plan for existing progress data

### 4.2. FSRS (Deferred)

**Status**: 🔮 NOT APPROVED for MVP — Research phase only

**Overview**: Free Spaced Repetition Scheduler with machine learning.

**Features**:
- ML-based difficulty estimation
- Adaptive scheduling based on user performance
- Requires training data from actual user reviews

**Challenges**:
- Requires significant user data for training
- Complex implementation
- Harder to explain to users
- Migration complexity

**Decision Required**: Product owner must explicitly approve FSRS research before any implementation work.

---

## 5. Migration Strategy

### 5.1. Phase 4: Domain Extraction (Approved)

**Goal**: Extract current algorithm into pure domain functions

**Tasks**:
1. Create `domain/services/srsService.ts`
2. Move scheduling logic from `vocabService.ts`
3. Add explicit timestamp parameter
4. Write comprehensive unit tests
5. Verify behaviour unchanged

**NOT in Phase 4**:
- No algorithm changes
- No new fields
- No database persistence changes

### 5.2. Phase 5: Persistence and Reliability (Approved)

**Goal**: Add database persistence, atomic RPC, idempotency

**Tasks**:
1. Create `review_logs` table
2. Implement `submit_vocabulary_rating` RPC
3. Update client to call RPC instead of direct progress update
4. Add idempotency key generation
5. Test duplicate submit protection

**NOT in Phase 5**:
- No algorithm changes
- No new states or ratings
- No enhanced SRS features

### 5.3. Future: Algorithm Enhancement (Deferred)

**Status**: 🔮 Requires explicit product owner approval

**Prerequisites**:
- Phase 5 completed and stable
- User feedback collected
- Product owner decision on SM-2 vs FSRS vs keep current
- Migration plan approved
- A/B testing framework ready

**Timeline**: TBD after MVP launch

---

## 6. Example Calculations

### 6.1. First Review Sequence

**Scenario**: New word, first time studying

**Fixed Timestamp**: `2026-07-30T10:00:00Z`

| Review | Rating | Previous Interval | New Interval | Next Review At | Status |
|--------|--------|-------------------|--------------|----------------|--------|
| 1 | Good | 0 hours | 24 hours | 2026-07-31T10:00:00Z | learning |
| 2 | Good | 24 hours | 72 hours (24×3) | 2026-08-03T10:00:00Z | learning |
| 3 | Easy | 72 hours | 288 hours (72×4) | 2026-08-15T10:00:00Z | learning |
| 4 | Good | 288 hours | 864 hours (288×3) | 2026-09-20T10:00:00Z | learning |

### 6.2. Lapse Scenario

**Scenario**: User forgets word after long interval

**Fixed Timestamp**: `2026-07-30T10:00:00Z`

| Review | Rating | Previous Interval | New Interval | Next Review At | Again Count |
|--------|--------|-------------------|--------------|----------------|-------------|
| 1 | Good | 0 hours | 24 hours | 2026-07-31T10:00:00Z | 0 |
| 2 | Good | 24 hours | 72 hours | 2026-08-03T10:00:00Z | 0 |
| 3 | Again | 72 hours | 0.0833 hours (5 min) | 2026-08-03T10:05:00Z | 1 |
| 4 | Hard | 0.0833 hours | 6 hours | 2026-08-03T16:05:00Z | 1 |
| 5 | Good | 6 hours | 18 hours (6×3) | 2026-08-04T10:05:00Z | 1 |

**Note**: Current algorithm does NOT have special lapse handling. "Again" simply resets to 5 minutes.

### 6.3. Manual Mastery

**Scenario**: User marks word as mastered

**Fixed Timestamp**: `2026-07-30T10:00:00Z`

| Review | Rating | Previous Interval | New Interval | Next Review At | Status |
|--------|--------|-------------------|--------------|----------------|--------|
| 1 | Good | 0 hours | 24 hours | 2026-07-31T10:00:00Z | learning |
| 2 | Mastered | 24 hours | 24 hours (unchanged) | null | mastered |

**Behaviour**: 
- `status` changes to `'mastered'`
- `next_review_at` becomes `null`
- Word removed from review queue
- `interval_hours` preserved but not used

---

## 7. Open Questions

### 7.1. Interval Growth Concern (Low Priority)

**Observation**: Current algorithm has no interval cap. Repeated "Easy" ratings lead to unbounded growth:
- 72h → 288h → 1,152h (48 days) → 4,608h (192 days) → 18,432h (768 days = 2+ years)

**Question**: Should MVP add an interval cap (e.g., max 365 days)?

**Options**:
- A: Add cap now (simple, prevents absurd intervals)
- B: Defer until user feedback (see if it's actually a problem)
- C: Never cap (trust user's "Easy" ratings)

**Current Decision**: 🔮 DEFERRED — Monitor in production, add cap if users report issues.

---

## 8. Document Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-30 | Phase 0 | Initial SRS spec with current and target algorithms |
| 2.0 | 2026-07-30 | Phase 0 Correction | Clarified MVP preserves current algorithm, moved SM-2/FSRS to deferred section, added atomic RPC pattern, fixed test examples with fixed timestamps |

**Next Review**: After Phase 4 domain extraction

**Approval Status**: ✅ MVP target approved — current algorithm with reliability enhancements only
