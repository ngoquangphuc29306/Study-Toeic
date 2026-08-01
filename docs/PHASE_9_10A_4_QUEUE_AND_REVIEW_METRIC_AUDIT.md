# Phase 9.10A.4 — Queue and Review Metric Audit

**Date:** 2026-08-01  
**Branch:** `feat/profile-management`  
**Status:** 🔍 AUDIT COMPLETE

---

## Executive Summary

Two critical bugs discovered during Phase 9.10A.3 manual testing:

**Bug 1 — "Chưa nhớ" in Pronunciation Mode Reinserts Card After 5 Positions**
- User clicks "Chưa nhớ" after pronunciation (correct or incorrect)
- Expected: Return to Flashcard mode, same word, no queue change
- Actual: Card reinserted 5 positions later in queue, advances to next card
- Root cause: `handleNotRemembered` calls `handleRating(false, 'again')` for pronunciation mode

**Bug 2 — Dashboard "Ôn tập" Metric Shows Wrong Count**
- Displays total reviews today (includes new words + due reviews)
- Expected: Only count due vocabulary reviewed today
- Root cause: Query doesn't filter by review type, counts ALL review_logs today

---

## Part 1: "Chưa nhớ" Queue Behavior Audit

### Current Flow Trace

**File:** `components/FlashcardMode.tsx`

**User Action:**
1. In pronunciation mode for word A
2. Speaks (correct or incorrect)
3. Clicks "Chưa nhớ" button (line 1434)

**Code Execution Path:**

**Step 1:** Button click handler (line 1434)
```typescript
<button onClick={handleNotRemembered}>
  <span>Chưa nhớ</span>
</button>
```

**Step 2:** `handleNotRemembered` function (lines 556-568)
```typescript
const handleNotRemembered = useCallback(() => {
  setShowRatingButtons(false);
  if (subMode === 'flashcard') {
    setSubMode('quiz');
  } else if (subMode === 'quiz') {
    setSubMode('typing');
  } else if (subMode === 'typing') {
    setSubMode('pronounce');
  } else if (subMode === 'pronounce') {
    handleRating(false, 'again');  // ⚠️ BUG HERE
    setSubMode('flashcard');
  }
}, [subMode, handleRating]);
```

**Line 565** is the ROOT CAUSE: `handleRating(false, 'again')`

**Step 3:** `handleRating` function execution (lines 450-545)

This function:
1. **Line 481:** Calls `onUpdateProgress(currentVocab.id, newStatus, 'again')`
   - Saves review log to Supabase with rating='again'
2. **Lines 490-495:** Calls `applyRatingToQueue('again', studyQueue, currentIndex, currentVocab.id)`
3. **Lines 498-499:** Updates queue and index with transition result

**Step 4:** `applyRatingToQueue` function (lib/session/queueTransition.ts lines 37-64)

```typescript
export function applyRatingToQueue(
  rating: 'again' | 'hard' | 'good' | 'easy' | 'mastered',
  currentQueue: string[],
  currentIndex: number,
  currentVocabId: string
): QueueTransition {
  if (rating === 'again') {
    const remainingQueue = currentQueue.slice(currentIndex + 1);
    
    const cleanQueue = removePendingDuplicate(
      remainingQueue,
      -1,
      currentVocabId
    );
    
    const updatedQueue = reinsertAfterGap(
      cleanQueue,
      currentVocabId,
      5  // ⚠️ REINSERTS AFTER 5 CARDS
    );
    
    const nextQueue = [
      ...currentQueue.slice(0, currentIndex + 1),
      ...updatedQueue,
    ];
    
    const nextIndex = currentIndex + 1;  // ⚠️ ADVANCES INDEX
    
    return {
      queue: nextQueue,
      currentIndex: nextIndex,
      isComplete: false,
    };
  }
  // ...
}
```

**Line 46-50:** Calls `reinsertAfterGap(cleanQueue, currentVocabId, 5)`
- This inserts the current card 5 positions later in the remaining queue

**Line 57:** Sets `nextIndex = currentIndex + 1`
- This advances to the next card

### Data Flow Proof

**Before "Chưa nhớ" click:**
```
currentIndex: 0
currentVocab.id: "vocab-A"
studyQueue: ["vocab-A", "vocab-B", "vocab-C", "vocab-D", "vocab-E", "vocab-F", "vocab-G"]
subMode: "pronounce"
```

**After `handleNotRemembered` execution:**
```
currentIndex: 1  (incremented by applyRatingToQueue)
currentVocab: "vocab-B"  (derived from studyQueue[1])
studyQueue: ["vocab-A", "vocab-B", "vocab-C", "vocab-D", "vocab-E", "vocab-F", "vocab-A", "vocab-G"]
                                                                      ^^^^^^^^ reinserted after 5
subMode: "flashcard"
```

**Result:** User sees vocab-B, and vocab-A will appear again after 5 more cards.

### Root Cause Summary

**Primary Issue:** Line 565 in `handleNotRemembered`
- Calls `handleRating(false, 'again')` when subMode === 'pronounce'
- This triggers full rating logic: save review log + requeue card + advance index

**Secondary Issue:** No distinction between pronunciation "not remembered" and actual "again" rating
- Both use same handler
- "Again" rating is designed to reinsert card after gap for spaced repetition
- Pronunciation "Chưa nhớ" should NOT trigger rating or queue modification

### Expected Behavior

When user clicks "Chưa nhớ" in pronunciation mode:

```typescript
// Pseudocode
if (subMode === 'pronounce') {
  stopRecognition();
  resetPronunciationState();
  setIsFlipped(false);
  setSubMode('flashcard');
  // NO handleRating call
  // NO queue modification
  // NO currentIndex change
  // NO review log creation
}
```

**Result:**
- Same word (currentIndex unchanged)
- Flashcard mode, front side visible
- No database write
- No queue mutation

---

## Part 2: Dashboard "Ôn tập" Metric Audit

### Current Implementation

**File:** `services/dashboardService.ts`

**Query (lines 109-121):**
```typescript
// Query 3: Today's reviews (count and unique vocabulary)
const { data: todayReviews, error: todayError } = await supabase
  .from('review_logs')
  .select('id, vocabulary_id')
  .gte('reviewed_at', startOfToday.toISOString())
  .lte('reviewed_at', endOfToday.toISOString());

if (todayError) throw todayError;

const reviewsToday = todayReviews?.length || 0;
const uniqueVocabToday = todayReviews
  ? new Set(todayReviews.map(r => r.vocabulary_id)).size
  : 0;
```

**Dashboard Display (components/Dashboard.tsx lines 474-481):**
```typescript
<div className="text-2xl sm:text-4xl font-extrabold text-gray-900">
  {isLoadingMetrics ? '...' : unlimitedReview
    ? `${dashboardMetrics?.uniqueVocabularyStudiedToday || 0}`
    : `${dashboardMetrics?.uniqueVocabularyStudiedToday || 0} / ${dailyReviewLimit}`
  } <span className="text-xs sm:text-sm font-semibold text-gray-500">
    {unlimitedReview ? 'từ' : ''}</span>
</div>
<div className="text-[10px] sm:text-xs text-[#ED4F8E] font-medium">
  {unlimitedReview ? 'Không giới hạn' : 'Đã ôn hôm nay'}
</div>
```

### What The Query Actually Counts

The query selects ALL `review_logs` from today without filtering, which includes:

1. **New words studied for the first time**
   - Word never seen before
   - Creates first review log with `previous_interval_hours = 0`
   - This is NOT a review, it's initial learning

2. **Due words reviewed**
   - Word already studied before
   - `next_review_at <= NOW()` at review time
   - `previous_interval_hours > 0`
   - This IS an actual review

3. **Not-yet-due words studied early** (if user manually studies)
   - Word already studied but not due yet
   - `next_review_at > NOW()` at review time
   - `previous_interval_hours > 0`
   - This is early review, not due review

### Schema Analysis

**review_logs table** (supabase/migrations/20260731093115_create_review_logs.sql):
```sql
CREATE TABLE public.review_logs (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    vocabulary_id UUID NOT NULL,
    rating TEXT NOT NULL CHECK (rating IN ('again', 'hard', 'good', 'easy', 'mastered')),
    previous_interval_hours NUMERIC(10, 4) NOT NULL CHECK (previous_interval_hours >= 0),
    new_interval_hours NUMERIC(10, 4) NOT NULL,
    next_review_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ NOT NULL,
    idempotency_key UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
```

**Key field:** `previous_interval_hours`

**From RPC** (supabase/migrations/20260731093116_create_submit_vocabulary_rating_rpc.sql line 89):
```sql
v_previous_interval_hours := COALESCE(v_current_progress.interval_hours, 0);
```

This means:
- **`previous_interval_hours = 0`** → Word had NO prior progress → NEW word first study
- **`previous_interval_hours > 0`** → Word had prior progress → REVIEW (due or early)

### Why The Metric Is Wrong

**Label says:** "Đã ôn hôm nay" (Reviewed today)
**Query counts:** ALL vocabulary studied today (new + reviewed)

**Test scenario:**
```
User has:
- 3 new words (never studied)
- 5 due words (need review today)

User studies:
- 2 new words → creates 2 review_logs with previous_interval_hours=0
- 3 due words → creates 3 review_logs with previous_interval_hours>0

Dashboard shows: 5 từ  (2 new + 3 due)
Should show: 3 từ  (only the 3 due reviews)
```

This explains why users see numbers that don't match their expectation of "review count".

### Additional Issue: No Distinction Between Due and Early Review

Even if we filter `previous_interval_hours > 0`, we still count words that weren't due yet.

However, **review_logs doesn't store whether the word was due at review time**. We only know:
- The word was reviewed (review_logs.reviewed_at)
- The next review time after this review (review_logs.next_review_at)
- But NOT whether `previous_next_review_at <= reviewed_at` (was it due?)

**Possible solutions:**
1. Add field to review_logs: `was_due BOOLEAN` (requires migration)
2. Infer from timing: if `previous_interval_hours > 0` it's likely a due review
3. Track session type when creating review (new study vs due review session)

For Phase 9.10A.4, **Solution 2** is acceptable:
- Filter `previous_interval_hours > 0` to exclude new words
- Assume words with previous interval > 0 are being reviewed (due or early)
- Most users follow the due schedule, so early reviews are rare
- This gives a practical approximation without migration

### Correct Query Design

```typescript
const { data: todayReviews, error: todayError } = await supabase
  .from('review_logs')
  .select('id, vocabulary_id')
  .gte('reviewed_at', startOfToday.toISOString())
  .lte('reviewed_at', endOfToday.toISOString())
  .gt('previous_interval_hours', 0);  // ✅ Only count reviews, not new studies
```

This filters to reviews only (words that had prior progress).

### Timezone Handling

**Current implementation** (lines 38-46):
```typescript
function getLocalDayBoundaries(date: Date = new Date()): [Date, Date] {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return [startOfDay, endOfDay];
}
```

This creates local date boundaries (00:00 to 23:59:59 in user's timezone), then converts to ISO string for query.

For Vietnam (UTC+7):
- Local 00:00 → ISO: "2026-07-31T17:00:00.000Z"
- Local 23:59:59 → ISO: "2026-08-01T16:59:59.999Z"

This is correct. The query filters review_logs by these timestamps, which are stored in UTC but compared correctly.

---

## Part 3: Files Requiring Changes

### 3.1 FlashcardMode.tsx

**Location:** `components/FlashcardMode.tsx`

**Changes Required:**

**Change 1:** Modify `handleNotRemembered` (lines 556-568)
- Add special case for `subMode === 'pronounce'`
- Do NOT call `handleRating`
- Only reset state and return to flashcard mode

**Current code:**
```typescript
const handleNotRemembered = useCallback(() => {
  setShowRatingButtons(false);
  if (subMode === 'flashcard') {
    setSubMode('quiz');
  } else if (subMode === 'quiz') {
    setSubMode('typing');
  } else if (subMode === 'typing') {
    setSubMode('pronounce');
  } else if (subMode === 'pronounce') {
    handleRating(false, 'again');  // ❌ BUG: calls rating
    setSubMode('flashcard');
  }
}, [subMode, handleRating]);
```

**Fixed code:**
```typescript
const handleNotRemembered = useCallback(() => {
  setShowRatingButtons(false);
  
  if (subMode === 'pronounce') {
    // Special case: pronunciation "not remembered" should NOT create rating
    // Just return to flashcard mode with same word
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (err) {
        // Ignore
      }
      recognitionRef.current = null;
    }
    
    // Reset pronunciation state
    setIsRecording(false);
    setTranscriptText('');
    setPronounceSubmitted(false);
    setIsPronounceCorrect(null);
    setPronounceError(null);
    
    // Return to flashcard, same word
    setIsFlipped(false);
    setSubMode('flashcard');
    return;  // ✅ Early return, no rating
  }
  
  // Normal flow for other modes
  if (subMode === 'flashcard') {
    setSubMode('quiz');
  } else if (subMode === 'quiz') {
    setSubMode('typing');
  } else if (subMode === 'typing') {
    setSubMode('pronounce');
  }
}, [subMode]);  // ✅ Remove handleRating from dependencies
```

**Change 2:** No other changes needed to FlashcardMode.tsx

The pronunciation "Đã thuộc" button already exists in the UI (inside pronunciation result section) and correctly calls rating to advance.

### 3.2 Dashboard Service

**Location:** `services/dashboardService.ts`

**Changes Required:**

**Change 1:** Update `getDashboardMetrics` query (lines 109-121)

**Current code:**
```typescript
const { data: todayReviews, error: todayError } = await supabase
  .from('review_logs')
  .select('id, vocabulary_id')
  .gte('reviewed_at', startOfToday.toISOString())
  .lte('reviewed_at', endOfToday.toISOString());
```

**Fixed code:**
```typescript
// Query 3: Today's DUE reviews (exclude new word first studies)
const { data: todayReviews, error: todayError } = await supabase
  .from('review_logs')
  .select('id, vocabulary_id')
  .gte('reviewed_at', startOfToday.toISOString())
  .lte('reviewed_at', endOfToday.toISOString())
  .gt('previous_interval_hours', 0);  // ✅ Only reviews, not first studies
```

**Change 2:** Update metric field name for clarity

**Current return (lines 126-136):**
```typescript
return {
  totalVocabulary: totalCount || 0,
  newVocabulary: newCount,
  learningVocabulary: learningCount,
  masteredVocabulary: masteredCount,
  dueVocabulary: dueCount,
  reviewsToday,
  uniqueVocabularyStudiedToday: uniqueVocabToday,  // ❌ Misleading name
  studyStreak: streak,
  difficultVocabulary: difficultCount,
};
```

**Consideration:** Keep `uniqueVocabularyStudiedToday` name for now to avoid breaking Dashboard.tsx
- The query fix makes it count correctly (only reviews)
- Renaming would require updating Dashboard component and types
- Current name is acceptable after query fix

**Change 3:** Update interface comment

**Location:** lines 14-24

**Current:**
```typescript
export interface DashboardMetrics {
  totalVocabulary: number;
  newVocabulary: number;
  learningVocabulary: number;
  masteredVocabulary: number;
  dueVocabulary: number;
  reviewsToday: number;
  uniqueVocabularyStudiedToday: number;
  studyStreak: number;
  difficultVocabulary: number;
}
```

**Add JSDoc comment:**
```typescript
export interface DashboardMetrics {
  totalVocabulary: number;
  newVocabulary: number;
  learningVocabulary: number;
  masteredVocabulary: number;
  dueVocabulary: number;  // Current count of words due for review
  reviewsToday: number;  // Total review actions today (includes duplicates)
  uniqueVocabularyStudiedToday: number;  // Unique due words reviewed today (previous_interval_hours > 0)
  studyStreak: number;
  difficultVocabulary: number;
}
```

### 3.3 Dashboard Component

**Location:** `components/Dashboard.tsx`

**No changes needed** — already displaying `uniqueVocabularyStudiedToday` correctly with limited/unlimited format.

The service fix will make the number correct automatically.

---

## Part 4: Migration Assessment

**Question:** Do we need a database migration?

**Answer:** NO

**Reasoning:**
- We can distinguish new vs review using existing `previous_interval_hours` field
- `previous_interval_hours = 0` → new word
- `previous_interval_hours > 0` → review
- No new columns needed
- No schema changes needed

**Limitation:**
- Cannot distinguish "due review" from "early review" (both have previous_interval_hours > 0)
- Acceptable trade-off: most users follow due schedule, early reviews are rare
- User sees "reviews today" which is technically correct even if word wasn't due

**Future enhancement** (NOT this phase):
- Add `was_due BOOLEAN` to review_logs
- Requires migration
- Set during RPC by checking `v_current_progress.next_review_at <= v_reviewed_at`

---

## Part 5: Test Requirements

### 5.1 "Chưa nhớ" Pronunciation Tests

**Test A: After Correct Pronunciation**
1. Start flashcard session with at least 10 words
2. Record currentIndex, currentVocab.id, studyQueue
3. Enter pronunciation mode
4. Speak correctly
5. See "Chính xác!" message
6. Click "Chưa nhớ" button
7. **Verify:**
   - Mode changes to flashcard immediately
   - currentIndex unchanged
   - currentVocab.id unchanged (same word)
   - studyQueue unchanged (no reinsert)
   - Flashcard shows front side
   - No review log created in Supabase

**Test B: After Incorrect Pronunciation**
1. Same setup as Test A
2. Speak incorrectly
3. See "Chưa đúng" message
4. Click "Chưa nhớ" button
5. **Verify:** Same as Test A

**Test C: Click "Đá thuộc" After Pronunciation**
1. Enter pronunciation mode
2. Speak (correct or incorrect)
3. Click "Đã thuộc" button
4. **Verify:**
   - Review log created
   - currentIndex incremented
   - Next card appears
   - Previous card NOT reinserted after 5

### 5.2 Dashboard Metric Tests

**Setup:** Create controlled test data
```
User account: test-user-001
Vocabularies:
- vocab-new-1: never studied (no progress record)
- vocab-new-2: never studied
- vocab-due-1: studied before, next_review_at = yesterday (DUE)
- vocab-due-2: studied before, next_review_at = yesterday (DUE)
- vocab-due-3: studied before, next_review_at = yesterday (DUE)
- vocab-future-1: studied before, next_review_at = tomorrow (NOT DUE)
```

**Test 1: Initial State**
- Dashboard shows "Đã ôn hôm nay: 0 / limit"

**Test 2: Study One New Word**
1. Study vocab-new-1, rate as "good"
2. Refresh dashboard
3. **Verify:** "Đã ôn hôm nay: 0 / limit" (unchanged)

**Test 3: Study One Due Word**
1. Study vocab-due-1, rate as "good"
2. Refresh dashboard
3. **Verify:** "Đã ôn hôm nay: 1 / limit"

**Test 4: Pronunciation "Chưa nhớ"**
1. Open vocab-due-2
2. Enter pronunciation mode
3. Click "Chưa nhớ"
4. Refresh dashboard
5. **Verify:** "Đã ôn hôm nay: 1 / limit" (unchanged from Test 3)

**Test 5: Study Same Due Word Twice**
1. Study vocab-due-2 again, rate as "hard"
2. Refresh dashboard
3. **Verify:** "Đã ôn hôm nay: 2 / limit"
4. Study vocab-due-2 third time, rate as "good"
5. Refresh dashboard
6. **Verify:** "Đã ôn hôm nay: 2 / limit" (still 2, unique count)

**Test 6: Study All Three Due Words**
1. Study vocab-due-3, rate as "easy"
2. Refresh dashboard
3. **Verify:** "Đã ôn hôm nay: 3 / limit"

**Test 7: Study Not-Yet-Due Word**
1. Manually study vocab-future-1 (not due yet)
2. Rate as "good"
3. Refresh dashboard
4. **Verify:** "Đã ôn hôm nay: 4 / limit" (counts as review because previous_interval > 0)
5. **Note:** This is acceptable behavior

**Test 8: Unlimited Mode Display**
1. Open Daily Goal settings
2. Enable "Unlimited Review"
3. **Verify:** Display shows "X từ | Không giới hạn"

**Test 9: User Isolation**
1. Logout test-user-001
2. Login as test-user-002
3. **Verify:** "Đã ôn hôm nay: 0 / limit" (different user sees 0)

**Test 10: Next Day Reset**
1. Advance system date to tomorrow
2. Refresh dashboard
3. **Verify:** "Đã ôn hôm nay: 0 / limit" (new day resets count)

---

## Part 6: Constraints

### Must NOT Change
- SRS algorithm (intervals for again/hard/good/easy/mastered)
- Database schema (no migration)
- Review log structure
- Queue transition logic for actual "again" ratings from flashcard mode
- Pronunciation "Đã thuộc" button behavior (already correct)
- Dashboard user-scoped settings (already correct from Phase 9.10A.3)
- Responsive layout
- Authentication flow
- Other Dashboard metrics (dueVocabulary, newVocabulary, etc.)

### Must Preserve
- "Chưa nhớ" behavior in flashcard/quiz/typing modes (cycle through modes)
- Pronunciation "Đã thuộc" creates review and advances (correct behavior)
- Limited vs unlimited review display format
- Timezone-aware date boundaries

---

## Part 7: Completion Criteria

**Task is complete when:**

1. ✅ "Chưa nhớ" in pronunciation mode returns to flashcard, same word
2. ✅ No queue modification when clicking "Chưa nhớ" in pronunciation
3. ✅ No review log created for pronunciation "Chưa nhớ"
4. ✅ currentIndex unchanged after pronunciation "Chưa nhớ"
5. ✅ Dashboard "Đã ôn hôm nay" starts at 0 before any due reviews
6. ✅ Studying new words does NOT increase "Đã ôn hôm nay"
7. ✅ Only reviewing words with previous_interval_hours > 0 increases metric
8. ✅ Same word reviewed multiple times counted once per day (unique)
9. ✅ Limited mode shows "X / limit | Đã ôn hôm nay"
10. ✅ Unlimited mode shows "X từ | Không giới hạn"
11. ✅ All quality gates pass (lint, typecheck, build, git check)
12. ✅ Manual tests pass with controlled data
13. ✅ No commit, no push, no deploy

---

**End of Audit**
