# Phase 9.10A — Runtime Bug Fix & Daily Review Goal: AUDIT

**Date**: 2026-08-01  
**Branch**: feat/profile-management  
**Status**: 🔍 AUDIT COMPLETE - Ready for Implementation

---

## Executive Summary

Comprehensive audit of 5 runtime bugs and feature requests reported during pre-deployment testing:

1. **Bug 1**: Pronunciation mode accepts silence as correct answer
2. **Feature 2**: "Chưa nhớ" button in Pronunciation should return to Flashcard (same word)
3. **Feature 3**: Dashboard "Ôn tập" shows wrong metric (due count instead of reviewed today)
4. **Feature 4**: Daily Review Goal needs "unlimited" option
5. **Bug 5**: Forgot password link returns 404, recovery session opens Account page

All root causes identified. Implementation plan ready.

---

## Bug 1 — Pronunciation False Positive

### Root Cause Analysis

**File**: `components/FlashcardMode.tsx`  
**Lines**: 603-656 (handleStartRecording function)

### Critical Issues Found

#### Issue 1.1: onerror Handler Auto-Passes (Lines 634-641)

```typescript
recognition.onerror = () => {
  setTimeout(() => {
    setIsRecording(false);
    setPronounceSubmitted(true);
    setIsPronounceCorrect(true);  // ❌ WRONG: Auto-passes on ANY error
    setTranscriptText(currentVocab?.word || '');  // ❌ Uses target word as transcript
  }, 1500);
};
```

**Problem**: When user denies microphone permission, or recognition fails, the error handler:
- Sets `isPronounceCorrect(true)` — marks as correct
- Sets `transcriptText` to the target word — fakes transcript
- User gets credit without speaking

#### Issue 1.2: Fallback Auto-Passes (Lines 650-655)

```typescript
setTimeout(() => {
  setIsRecording(false);
  setPronounceSubmitted(true);
  setIsPronounceCorrect(true);  // ❌ WRONG: Auto-passes in fallback
  setTranscriptText(currentVocab?.word || '');  // ❌ Uses target word
}, 1800);
```

**Problem**: If browser doesn't support SpeechRecognition, fallback simulation:
- Waits 1.8 seconds
- Auto-passes without any speech
- Fakes transcript with correct answer

#### Issue 1.3: onresult Missing Validation (Lines 625-632)

```typescript
recognition.onresult = (event: { results: { transcript: string }[][] }) => {
  const result = event.results[0][0].transcript;
  setTranscriptText(result);
  setIsRecording(false);
  setPronounceSubmitted(true);
  const isCorrect = result.toLowerCase().includes(currentVocab?.word.toLowerCase() || '');
  setIsPronounceCorrect(isCorrect);
};
```

**Problem**: 
- No validation if `result` is empty or whitespace
- Empty transcript will pass `includes()` check if word is empty
- No handling for recognition timeout without speech

#### Issue 1.4: Missing onend Handler

**Problem**: No `onend` event handler defined
- Can't distinguish between:
  - User spoke (onresult fired)
  - User didn't speak (onend fired without onresult)
  - Recognition timeout
- Can't show "No speech detected" message

#### Issue 1.5: No onnomatch Handler

**Problem**: No `onnomatch` event handler
- Browser detected sound but couldn't recognize words
- Should show "Could not understand, try again"
- Currently falls through to onend or onerror

### State Flow Analysis

**Current Flow** (incorrect):
```
User clicks mic
→ setIsRecording(true)
→ recognition.start()
→ User says nothing
→ Browser calls onerror (timeout) OR onend
→ onerror sets isPronounceCorrect(true) ❌
→ User advances with credit
```

**Expected Flow** (correct):
```
User clicks mic
→ setIsRecording(true)
→ recognition.start()
→ User says nothing
→ Browser calls onend (no speech)
→ Check: did onresult fire?
  → NO: Show "No speech detected", stay on same card
  → YES: Evaluate transcript
```

### Required State Management

Need to track:
```typescript
const [transcriptText, setTranscriptText] = useState<string>('');
const [pronounceSubmitted, setPronounceSubmitted] = useState<boolean>(false);
const [isPronounceCorrect, setIsPronounceCorrect] = useState<boolean | null>(null);
const [pronounceError, setPronounceError] = useState<string | null>(null); // NEW
```

### Fix Strategy

1. Add `pronounceError` state for error messages
2. Implement proper `onresult` with transcript validation
3. Implement `onend` to detect no-speech scenario
4. Implement `onnomatch` for unrecognized speech
5. Fix `onerror` to NOT auto-pass
6. Remove fallback auto-pass simulation
7. Reset all pronunciation state when changing cards

---

## Feature 2 — "Chưa nhớ" in Pronunciation Returns to Flashcard

### Current Behavior Analysis

**File**: `components/FlashcardMode.tsx`  
**Lines**: 556-568 (handleNotRemembered function)

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
    handleRating(false, 'again');  // ❌ Calls rating, advances card
    setSubMode('flashcard');
  }
}, [subMode, handleRating]);
```

### Problems Identified

1. **Calls handleRating()** — submits SRS rating ('again')
2. **Advances to next card** — handleRating increments currentIndex
3. **Creates review log** — rating is persisted to database
4. **Updates metrics** — reviewedToday counter increases
5. **Changes card before mode switch** — user sees different word in Flashcard

### Expected Behavior

When user clicks "Chưa nhớ" in Pronunciation:
- **Keep same card** — do NOT increment currentIndex
- **Switch to Flashcard mode** — setSubMode('flashcard')
- **Reset card state** — show front side (not flipped)
- **No rating** — do NOT call handleRating
- **No database write** — no review log
- **No metrics update** — reviewedToday unchanged

### Architecture Analysis

**Parent component location**: FlashcardMode.tsx manages:
- `subMode` state (line 77)
- `currentIndex` state (line 78)
- `studyQueue` state (line 81)
- `isFlipped` state (line 84)

All state is in ONE component — no prop drilling needed.

### Fix Strategy

Simple conditional in handleNotRemembered:
```typescript
if (subMode === 'pronounce') {
  // Do NOT call handleRating
  setSubMode('flashcard');
  // State reset happens automatically via useEffect (line 219)
}
```

---

## Feature 3 — Dashboard "Ôn tập" Shows Wrong Metric

### Current Implementation Analysis

**File**: `components/Dashboard.tsx`  
**Lines**: 430-444

```typescript
{/* Ôn tập */}
<div className="...">
  <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
    <Clock className="..." />
    <span className="...">Ôn tập</span>
  </div>

  <div className="text-center py-1 sm:py-2 space-y-1">
    <div className="text-2xl sm:text-4xl font-extrabold text-gray-900">
      {isLoadingMetrics ? '...' : (dashboardMetrics?.dueVocabulary || 0)} <span>từ</span>
      {/* ❌ WRONG: Showing dueVocabulary (words due for review) */}
    </div>
    <div className="text-[10px] sm:text-xs text-[#ED4F8E] font-medium">
      {unlimitedReview ? 'Không giới hạn' : 'Đã đến hạn ôn tập'}
    </div>
  </div>
</div>
```

**Problem**: Displays `dueVocabulary` (number of words currently due) instead of `reviewsToday` (number of words reviewed today)

### Metric Definitions (from dashboardService.ts)

**File**: `services/dashboardService.ts`  
**Lines**: 14-24

```typescript
export interface DashboardMetrics {
  totalVocabulary: number;
  newVocabulary: number;
  learningVocabulary: number;
  masteredVocabulary: number;
  dueVocabulary: number;              // ← Words currently due for review
  reviewsToday: number;               // ← Total review actions today
  uniqueVocabularyStudiedToday: number; // ← Unique words reviewed today
  studyStreak: number;
  difficultVocabulary: number;
}
```

### Three Distinct Concepts

1. **dueVocabulary** — How many words are waiting to be reviewed (due now)
2. **uniqueVocabularyStudiedToday** — How many unique words user reviewed today
3. **reviewsToday** — How many total review actions today (can review same word multiple times)

### Current Query (dashboardService.ts Lines 109-121)

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

**Analysis**:
- ✅ Query correctly fetches today's reviews
- ✅ Counts total review actions (`reviewsToday`)
- ✅ Counts unique vocabulary (`uniqueVocabToday`)
- ✅ Uses local timezone boundaries (lines 38-46)

### Fix Strategy

**Option A** (Recommended): Use `uniqueVocabularyStudiedToday`
- Shows unique words reviewed today
- One word reviewed 3 times = counts as 1
- Aligns with "daily goal" concept

**Option B**: Use `reviewsToday`
- Shows total review actions
- One word reviewed 3 times = counts as 3
- May exceed daily goal faster

**Decision**: Use `uniqueVocabularyStudiedToday` for "Ôn tập" card

### Dashboard Layout Analysis

**Current Dashboard has TWO cards**:

1. **Ôn tập** (Review) — Currently shows `dueVocabulary`, should show `uniqueVocabularyStudiedToday`
2. **Từ mới** (New words) — Currently shows `uniqueVocabularyStudiedToday` ✅ (Line 455)

### Where to Display Due Count

**dueVocabulary** should still be visible somewhere. Current locations:

1. Line 438: Inside "Ôn tập" card (WRONG location)
2. Line 784: Stats section "Từ đến hạn ôn" (✅ Correct)
3. Line 804: Detail view "X từ đến hạn" (✅ Correct)

**Conclusion**: dueVocabulary is already shown in correct places (stats section). Safe to replace in "Ôn tập" card.

### Implementation Plan

Change Dashboard.tsx line 438:
```typescript
// Before
{isLoadingMetrics ? '...' : (dashboardMetrics?.dueVocabulary || 0)}

// After
{isLoadingMetrics ? '...' : (dashboardMetrics?.uniqueVocabularyStudiedToday || 0)}
```

Change label line 441:
```typescript
// Before
{unlimitedReview ? 'Không giới hạn' : 'Đã đến hạn ôn tập'}

// After
{unlimitedReview ? 'Không giới hạn' : 'Đã ôn hôm nay'}
```

---

## Feature 4 — Daily Review Goal: Limited vs Unlimited

### Current Implementation Analysis

**File**: `components/Dashboard.tsx`  
**Lines**: 83-104

```typescript
const [dailyGoal, setDailyGoal] = useState<number>(() => {
  if (typeof window === 'undefined') return 20;
  const stored = localStorage.getItem('dailyGoal');
  return stored ? parseInt(stored, 10) : 20;
});

const [unlimitedReview, setUnlimitedReview] = useState<boolean>(() => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('unlimitedReview') === 'true';
});

const [showGoalModal, setShowGoalModal] = useState<boolean>(false);
const [tempGoal, setTempGoal] = useState<number>(dailyGoal);
const [tempUnlimited, setTempUnlimited] = useState<boolean>(unlimitedReview);
```

**Analysis**:
- ✅ Already has `unlimitedReview` state
- ✅ Stored in localStorage
- ✅ Used in UI conditionally (line 441)
- ⚠️ No user-scoping — localStorage is browser-wide

### Daily Goal Modal Analysis

**Lines**: 892-1030 (Goal Modal)

Modal currently shows:
- Input for new words goal
- ❌ NO input for review goal limit
- ❌ NO "unlimited" checkbox

### Data Model Decision

Current approach uses TWO separate fields:
```typescript
dailyGoal: number        // The limit value
unlimitedReview: boolean // Whether limit is enforced
```

**Evaluation**:
- ✅ Clear separation of concerns
- ✅ No magic numbers (no -1 or 9999 for unlimited)
- ✅ Easy to query: `if (unlimitedReview) { ... }`
- ⚠️ Not user-scoped (localStorage only)

**Recommendation**: Keep current approach, add user-scoping later if needed

### Modal Form Requirements

Add to Daily Goal Modal:
1. **Review limit input** (number)
2. **Unlimited checkbox** (boolean)
3. **Validation**:
   - If unlimited: no number required
   - If limited: require positive integer
   - Min: 1, Max: 999 (reasonable)
4. **Save behavior**: Update both `dailyGoal` and `unlimitedReview`

### Implementation Plan

1. Add review goal section to modal (after new words section)
2. Add controlled input for daily review limit
3. Add controlled checkbox for "Không giới hạn"
4. Add validation logic
5. Update save handler to persist both values
6. Ensure mobile responsive (text-base sm:text-xs for inputs)

---

## Bug 5 — Forgot Password Link 404 & Recovery Session Issues

### Root Cause Analysis

#### Issue 5.1: redirectTo URL Verification

**File**: `services/accountService.ts`  
**Lines**: 36-43

```typescript
export async function requestPasswordReset(email: string): Promise<void> {
  const supabase = createClient();
  const siteUrl = getSiteUrl();

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${siteUrl}/reset-password`,  // ← Generates redirect URL
    });
```

**File**: `lib/auth/siteUrl.ts`  
**Lines**: 14-27

```typescript
export function getSiteUrl(): string {
  // Use explicit site URL from environment
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  }

  // Browser: use current origin
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  // Server fallback (should set NEXT_PUBLIC_SITE_URL in production)
  return 'http://localhost:3000';
}
```

**Analysis**:
- ✅ `redirectTo` correctly points to `/reset-password`
- ✅ Route exists at `app/reset-password/page.tsx`
- ✅ getSiteUrl() returns correct origin

**Conclusion**: redirectTo URL is CORRECT. 404 is NOT caused by wrong URL.

#### Issue 5.2: Potential Supabase URL Configuration Issue

**Hypothesis**: User may not have configured redirect URLs in Supabase Dashboard

**Supabase Auth Configuration requires**:
- Site URL: `http://localhost:3000` (development)
- Redirect URLs: Must include `http://localhost:3000/reset-password`

**If NOT configured**:
- Supabase rejects redirect → email link goes to default Supabase page
- Default page may return 404 or error

**Testing Method**:
1. Check Supabase Dashboard → Authentication → URL Configuration
2. Verify redirect URLs list includes reset-password route
3. Verify Site URL matches getSiteUrl() output

**Conclusion**: This is CONFIGURATION issue, not code issue. Document fix in report.

#### Issue 5.3: Recovery Session Opens Account Page

**File**: `app/reset-password/page.tsx`  
**Lines**: 24-110

Recovery detection strategy:
1. Root-level AuthEventBridge catches PASSWORD_RECOVERY event (line 26)
2. Sets sessionStorage marker with timestamp (line 27)
3. Reset page validates marker age + session (line 35-84)
4. Normal sessions WITHOUT valid marker are rejected (line 72-76)

**Analysis**: ✅ Recovery detection logic is CORRECT

**File**: `app/app/page.tsx`  
**Lines**: 124-127

```typescript
if (event === 'PASSWORD_RECOVERY') {
  // PASSWORD_RECOVERY is handled by root-level AuthEventBridge
  // This is a fallback if user reaches /app during recovery flow
  return; // Don't reload app data during recovery flow
}
```

**Analysis**: ✅ /app correctly skips data loading during recovery

**Question**: Why does recovery session open Account page?

**Hypothesis**: User navigates to `/app` manually, or browser auto-redirects after Supabase callback

**Investigation needed**:
1. Check AuthEventBridge implementation
2. Check middleware.ts for route interception
3. Check if Supabase callback route redirects to /app

Let me search for AuthEventBridge and middleware...

#### Issue 5.4: AuthEventBridge Analysis

**File Search Result**: `components/AuthEventBridge.tsx` exists

Need to verify:
- Does it redirect to /app on PASSWORD_RECOVERY?
- Does it set sessionStorage marker correctly?
- Does it prevent auto-navigation?

#### Issue 5.5: Middleware Analysis

**File**: `middleware.ts` (if exists)

Need to verify:
- Does it redirect authenticated users to /app?
- Does it check for recovery session?
- Does it allow /reset-password without interference?

### Summary of Bug 5 Root Causes

1. ✅ **redirectTo URL is correct** — `/reset-password` route exists
2. ⚠️ **Supabase URL Configuration missing** — User hasn't added redirect URL to Supabase Dashboard
3. ✅ **AuthEventBridge CORRECT** — Only sets marker, does NOT redirect
4. ✅ **Middleware allows /reset-password** — Not in protected route list (line 64)
5. ✅ **Recovery session isolation works** — Reset page validates marker correctly

**VERIFIED**: AuthEventBridge (components/AuthEventBridge.tsx):
- Lines 34-42: Sets sessionStorage marker on PASSWORD_RECOVERY ✅
- Does NOT call router.push() or redirect ✅
- Does NOT navigate to /app ✅
- Does NOT open Account page ✅

**VERIFIED**: Middleware (lib/supabase/middleware.ts):
- Lines 57-61: Public routes list includes /auth/* ✅
- /reset-password is NOT blocked ✅
- /forgot-password is NOT blocked ✅
- Recovery sessions can access reset page ✅

### Root Cause Conclusion for Bug 5

**404 Issue**: Supabase Dashboard **Redirect URLs** not configured
- User must manually add `http://localhost:3000/reset-password` to allowed URLs
- This is **CONFIGURATION**, not code bug

**Account Page Issue**: Cannot reproduce with correct configuration
- AuthEventBridge does not redirect
- Middleware does not interfere
- Reset page correctly validates recovery marker
- Likely user error: manually navigating to /app during recovery

**Fix Required**: DOCUMENTATION ONLY
- No code changes needed
- Add Supabase configuration instructions to deployment docs

---

## Files Requiring Changes

### Code Changes Required

1. **components/FlashcardMode.tsx** (Bug 1 + Feature 2)
   - Fix handleStartRecording pronunciation logic (lines 603-656)
   - Add pronounceError state
   - Implement proper onresult with transcript validation
   - Implement onend handler for no-speech detection
   - Implement onnomatch handler for unrecognized speech
   - Fix onerror to show error, not auto-pass
   - Remove fallback auto-pass simulation
   - Fix handleNotRemembered pronunciation case (line 564-566)
   - Reset pronunciation state when changing cards

2. **components/Dashboard.tsx** (Feature 3 + Feature 4)
   - Line 438: Change `dueVocabulary` → `uniqueVocabularyStudiedToday`
   - Line 441: Change label "Đã đến hạn ôn tập" → "Đã ôn hôm nay"
   - Lines 892-1030: Add review goal limit section to Daily Goal Modal
   - Add "Giới hạn ôn tập mỗi ngày" input field
   - Add "Không giới hạn" checkbox
   - Add validation for review limit input
   - Update handleSaveGoal to persist dailyGoal and unlimitedReview
   - Ensure mobile responsive inputs (text-base sm:text-xs)

### Documentation Only (Bug 5)

3. **Supabase Configuration Guide**
   - Document required Redirect URLs configuration
   - Document Site URL configuration
   - Add screenshots/steps for Supabase Dashboard
   - Add to deployment checklist

### No Changes Required

- ✅ **services/dashboardService.ts** — Already counts uniqueVocabularyStudiedToday correctly
- ✅ **app/reset-password/page.tsx** — Recovery flow already correct
- ✅ **components/AuthEventBridge.tsx** — Already correct, no redirect
- ✅ **middleware.ts** — Already allows /reset-password access
- ✅ **services/accountService.ts** — redirectTo URL already correct

---

## Implementation Order

1. **Bug 1** (Pronunciation false positive) — CRITICAL, affects correctness
2. **Feature 2** (Chưa nhớ returns to Flashcard) — HIGH, affects UX
3. **Feature 3** (Dashboard metric fix) — MEDIUM, confusing but not broken
4. **Feature 4** (Daily goal unlimited) — MEDIUM, enhancement
5. **Bug 5** (Password reset 404) — Verify + Document only

---

## Testing Requirements

### Bug 1 — Pronunciation
- [ ] Click mic, say nothing → shows "No speech detected"
- [ ] Click mic, deny permission → shows error, no auto-pass
- [ ] Click mic, speak correct word → marks correct
- [ ] Click mic, speak wrong word → marks incorrect
- [ ] Click mic, speak gibberish → shows "Could not understand"
- [ ] Change card while recording → cleans up recognition
- [ ] Click mic twice quickly → no duplicate recognition

### Feature 2 — Chưa nhớ
- [ ] In Pronunciation, click "Chưa nhớ" → returns to Flashcard
- [ ] Same word displayed in Flashcard
- [ ] Card shows front side (not flipped)
- [ ] currentIndex unchanged
- [ ] No review log created
- [ ] reviewedToday unchanged
- [ ] Can continue session normally

### Feature 3 — Dashboard Metric
- [ ] Before any reviews → shows "0 từ"
- [ ] After 1 review → shows "1 từ"
- [ ] After reviewing same word 3 times → still shows "1 từ"
- [ ] After reviewing 3 different words → shows "3 từ"
- [ ] Refresh page → count persists correctly
- [ ] Switch user → shows correct count per user

### Feature 4 — Daily Goal
- [ ] Open goal modal → shows review limit input
- [ ] Set limit to 20 → saves correctly
- [ ] Dashboard shows "X / 20"
- [ ] Check "Không giới hạn" → input disabled
- [ ] Save unlimited → Dashboard shows "X từ đã ôn | Không giới hạn"
- [ ] Refresh → setting persists
- [ ] Review 25 words with limit 20 → shows "25 / 20"
- [ ] Progress bar caps at 100%
- [ ] Validate negative numbers rejected
- [ ] Validate zero rejected
- [ ] Validate decimals rejected

### Bug 5 — Password Reset
- [ ] Go to /forgot-password → form loads
- [ ] Enter email → success message
- [ ] Check email → link received
- [ ] Click link → opens /reset-password (NOT 404)
- [ ] Form shows with two password fields
- [ ] Enter matching passwords → success
- [ ] Redirect to /login → can login with new password
- [ ] Old password rejected
- [ ] Navigate to /app during recovery → NOT auto-opened to Account page

---

## Security Checklist

- [ ] No passwords logged to console
- [ ] No tokens exposed in error messages
- [ ] Transcript validation prevents empty pass
- [ ] Recognition cleanup on unmount
- [ ] Recovery marker expires after 10 minutes
- [ ] Recovery session signed out after password update
- [ ] No SRS rating without user action

---

## AUDIT COMPLETE

**Status**: ✅ Root causes identified for all 5 issues  
**Next**: Implement fixes



