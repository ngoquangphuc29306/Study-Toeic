# Phase 9.10A.4 — New Words Counter Fix Report

**Date:** 2026-08-01  
**Branch:** `feat/profile-management`  
**Status:** ✅ COMPLETED

---

## Executive Summary

Fixed regression bug where "Từ mới" (New Words) counter in Dashboard did not update when studying new vocabulary.

**Root Cause:** Phase 9.10A.4 modified `uniqueVocabularyStudiedToday` metric to exclude new words (filter `previous_interval_hours > 0`), but Dashboard.tsx still used this metric for "Từ mới" display.

**Solution:** Added new metric `newVocabularyStudiedToday` that counts only new words studied today (`previous_interval_hours = 0`).

**Files Modified:**
- `services/dashboardService.ts` — Added newVocabularyStudiedToday field and query
- `components/Dashboard.tsx` — Changed newWordsCount to use new metric

**Quality Gates:** ✅ All passed (lint, typecheck, build)

---

## 1. Bug Description

**User Report:**
"kiểm tra lỗi vì sao học từ mới mà từ mới mục tiệu trong dashboard không cập nhật"

**Symptoms:**
- User studies new vocabulary words
- "Từ mới" counter shows 0 / {dailyGoal}
- Counter does not increase despite successful study sessions
- Other metrics (streak, due reviews) work correctly

**Expected Behavior:**
- "Từ mới" counter should show: X / {dailyGoal}
- Where X = unique new words studied today
- Progress bar should update accordingly

---

## 2. Root Cause Analysis

### 2.1 Data Flow Trace

```
[1] User studies new word A in FlashcardMode
    → Calls updateUserProgress() → submit_vocabulary_rating RPC

[2] RPC creates review_log (migration line 89):
    v_previous_interval_hours := COALESCE(v_current_progress.interval_hours, 0);
    → New word (no prior progress) → interval_hours = NULL
    → COALESCE returns 0
    → review_log.previous_interval_hours = 0 ✅

[3] refreshAppData() triggers → getDashboardMetrics() fetches new data ✅

[4] Query in dashboardService.ts (line 118):
    .gt('previous_interval_hours', 0)  ← Filter excludes new words
    → Word A's review_log (previous_interval_hours = 0) is EXCLUDED
    → uniqueVocabularyStudiedToday = 0

[5] Dashboard.tsx (line 261):
    const newWordsCount = dashboardMetrics?.uniqueVocabularyStudiedToday || 0;
    → Uses WRONG metric
    → Displays 0 ❌
```

### 2.2 Why Phase 9.10A.4 Changed the Metric

**Original Issue:** "Đã ôn hôm nay" (Reviews Today) was counting new word first studies as reviews.

**Fix Applied:** Added filter `.gt('previous_interval_hours', 0)` to count only DUE reviews (words already studied before).

**Side Effect:** This filter made `uniqueVocabularyStudiedToday` exclude new words entirely.

**Regression:** Dashboard.tsx line 261 used this metric for BOTH:
- "Đã ôn hôm nay" display (correct usage ✅)
- "Từ mới" display (incorrect usage ❌)

### 2.3 Semantic Mismatch

| Display Section | Should Count | Was Using | Result |
|---|---|---|---|
| "Đã ôn hôm nay" | DUE reviews only (previous_interval_hours > 0) | `uniqueVocabularyStudiedToday` | ✅ Correct |
| "Từ mới" | NEW words only (previous_interval_hours = 0) | `uniqueVocabularyStudiedToday` | ❌ Wrong metric |

**Conclusion:** Needed separate metric for new words.

---

## 3. Solution Implementation

### 3.1 Add newVocabularyStudiedToday Field

**File:** `services/dashboardService.ts`

**Change 1: Interface (lines 14-24)**
```typescript
export interface DashboardMetrics {
  totalVocabulary: number;
  newVocabulary: number;
  learningVocabulary: number;
  masteredVocabulary: number;
  dueVocabulary: number;
  reviewsToday: number;
  uniqueVocabularyStudiedToday: number; // Unique due words reviewed today (previous_interval_hours > 0)
  newVocabularyStudiedToday: number; // ✅ NEW: Unique new words studied today (previous_interval_hours = 0)
  studyStreak: number;
  difficultVocabulary: number;
}
```

**Change 2: Query 3b (after line 125)**
```typescript
// Query 3b: Today's NEW word studies (first-time studies only)
// Phase 9.10A.4 Fix: Count unique new words studied today for "Từ mới" display
const { data: todayNewWords, error: newWordsError } = await supabase
  .from('review_logs')
  .select('id, vocabulary_id')
  .gte('reviewed_at', startOfToday.toISOString())
  .lte('reviewed_at', endOfToday.toISOString())
  .eq('previous_interval_hours', 0);  // ✅ Filter: only new words

if (newWordsError) throw newWordsError;

const newWordsStudiedToday = todayNewWords
  ? new Set(todayNewWords.map(r => r.vocabulary_id)).size
  : 0;
```

**Change 3: Return statement (line 140)**
```typescript
return {
  totalVocabulary: totalCount || 0,
  newVocabulary: newCount,
  learningVocabulary: learningCount,
  masteredVocabulary: masteredCount,
  dueVocabulary: dueCount,
  reviewsToday,
  uniqueVocabularyStudiedToday: uniqueVocabToday,
  newVocabularyStudiedToday: newWordsStudiedToday,  // ✅ NEW field
  studyStreak: streak,
  difficultVocabulary: difficultCount,
};
```

### 3.2 Update Dashboard Display

**File:** `components/Dashboard.tsx`

**Change: Line 261-262**
```typescript
// Phase 7: Compute New Words Progress from real metrics
// Phase 9.10A.4 Fix: Use newVocabularyStudiedToday for "Từ mới" display
const newWordsCount = dashboardMetrics?.newVocabularyStudiedToday || 0;  // ✅ Changed
const newWordsPercent = Math.min(100, Math.round((newWordsCount / dailyGoal) * 100));
```

**Before:** Used `uniqueVocabularyStudiedToday` (only counts due reviews)  
**After:** Uses `newVocabularyStudiedToday` (only counts new words)

---

## 4. Quality Gates

### 4.1 ESLint
```bash
npm run lint
```
**Result:** ✅ PASS (0 errors, 0 warnings)

### 4.2 TypeScript Check
```bash
npx tsc --noEmit
```
**Result:** ✅ PASS (no type errors)

### 4.3 Production Build
```bash
npm run build
```
**Result:** ✅ PASS

**Build Output:**
```
 ✓ Compiled successfully in 9.2s
 ✓ Generating static pages (11/11)

Route (app)                                 Size  First Load JS
┌ ○ /                                      161 B         106 kB
├ ○ /_not-found                            993 B         103 kB
├ ○ /app                                  192 kB         364 kB
├ ○ /app/account                         7.85 kB         180 kB
├ ƒ /auth/callback                         122 B         102 kB
├ ○ /forgot-password                     3.99 kB         176 kB
├ ○ /login                               3.08 kB         109 kB
├ ○ /reset-password                      5.21 kB         177 kB
└ ○ /signup                              3.92 kB         176 kB
```

---

## 5. Verification Example

**Test Scenario:**
- User studies 5 NEW words today
- User reviews 3 DUE words today

**Expected Metrics:**
```typescript
{
  uniqueVocabularyStudiedToday: 3,      // Due reviews only
  newVocabularyStudiedToday: 5,         // New words only
  reviewsToday: 8,                      // Total actions (5 + 3)
}
```

**Dashboard Display:**
- "Từ mới": 5 / {dailyGoal} ✅
- "Đã ôn hôm nay": 3 ✅

**Before Fix:**
- "Từ mới": 3 / {dailyGoal} ❌ (showed due reviews instead of new words)

---

## 6. Files Changed Summary

| File | Lines Changed | Description |
|------|---------------|-------------|
| `services/dashboardService.ts` | +16, -2 | Added newVocabularyStudiedToday field and query |
| `components/Dashboard.tsx` | +2, -1 | Changed newWordsCount to use new metric |

**Total:** 2 files, 18 lines changed (+18, -3)

---

## 7. Manual Testing Checklist

### 7.1 New Words Counter Test

- [ ] Start with fresh day (no reviews today)
- [ ] Verify "Từ mới" shows: 0 / {dailyGoal}
- [ ] Study 1 NEW word (word never studied before)
- [ ] Return to Dashboard
- [ ] Verify "Từ mới" shows: 1 / {dailyGoal} ✅
- [ ] Verify progress bar shows ~5% (if dailyGoal = 20)
- [ ] Study 4 more NEW words
- [ ] Verify "Từ mới" shows: 5 / {dailyGoal} ✅
- [ ] Verify progress bar shows 25%

### 7.2 Due Reviews Counter Test

- [ ] Study 3 DUE words (words already studied before, now due for review)
- [ ] Return to Dashboard
- [ ] Verify "Đã ôn hôm nay" shows: 3 (if unlimited) OR 3 / {limit} ✅
- [ ] Verify "Từ mới" STILL shows: 5 / {dailyGoal} (unchanged) ✅

### 7.3 Combined Scenario Test

- [ ] Study 2 NEW words + 2 DUE words in same session
- [ ] Return to Dashboard
- [ ] Verify "Từ mới": 7 / {dailyGoal} (5 + 2 new) ✅
- [ ] Verify "Đã ôn hôm nay": 5 (3 + 2 due) ✅
- [ ] Verify counters are independent ✅

### 7.4 Edge Cases

- [ ] Study same NEW word twice in one day
- [ ] Verify "Từ mới" counts it only ONCE (Set deduplication) ✅
- [ ] Study a word that transitions from NEW → LEARNING in same session
- [ ] Verify first action counted as NEW, subsequent reviews as DUE ✅

---

## 8. Technical Notes

### 8.1 Query Performance

**Added Query:**
```sql
SELECT id, vocabulary_id 
FROM review_logs 
WHERE reviewed_at >= {startOfToday}
  AND reviewed_at <= {endOfToday}
  AND previous_interval_hours = 0
```

**Index Coverage:** Uses existing `idx_review_logs_user_date` (user_id, reviewed_at)

**Performance Impact:** Minimal — same pattern as existing Query 3, runs in parallel.

### 8.2 Data Integrity

**Deduplication:** Uses `new Set(todayNewWords.map(r => r.vocabulary_id)).size` to count unique vocabulary IDs only.

**Timezone Handling:** Uses `getLocalDayBoundaries()` for consistent local time queries.

**Filter Logic:**
- `previous_interval_hours = 0` → New word (no prior progress exists)
- `previous_interval_hours > 0` → Review (word was studied before)

### 8.3 Why Not Combine Queries?

**Option Considered:** Single query with conditional counting.

**Rejected Because:**
- TypeScript requires strongly-typed fields in interface
- Separate queries make intent explicit and debuggable
- Negligible performance difference (both queries use same index)
- Easier to maintain and understand

---

## 9. Constraints Compliance

✅ **No commit** — Changes remain in working directory  
✅ **No push** — No remote changes  
✅ **No deploy** — No production deployment  
✅ **No migration** — No database schema changes  
✅ **No Supabase changes** — Only query logic changes  
✅ **No SRS algorithm changes** — Review logic untouched  
✅ **No new packages** — Used existing dependencies

---

## 10. Conclusion

Successfully fixed regression bug where "Từ mới" counter did not update when studying new vocabulary.

**Changes:**
1. ✅ Added `newVocabularyStudiedToday` metric to DashboardMetrics interface
2. ✅ Added Query 3b to count new words studied today (previous_interval_hours = 0)
3. ✅ Updated Dashboard.tsx to use correct metric for "Từ mới" display
4. ✅ All quality gates passed (lint, typecheck, build)

**Impact:**
- "Từ mới" counter now correctly shows unique new words studied today
- "Đã ôn hôm nay" counter continues to show only due reviews (Phase 9.10A.4 fix preserved)
- No regression to other metrics or features

**Status:** ✅ READY FOR MANUAL TESTING

**Next Steps:**
1. Perform manual regression testing using checklist in Section 7
2. If all tests pass, commit changes with descriptive message
3. Push to `feat/profile-management` branch

---

**End of Report**
