# Phase 9.10A.3 — Remaining Runtime Fixes Audit

**Date:** 2026-08-01  
**Branch:** feat/profile-management  
**Status:** 🔍 AUDIT IN PROGRESS

---

## Executive Summary

This audit identifies remaining issues from Phase 9.10A that were partially addressed but not fully completed. The focus is on:

1. **Pronunciation Error UI** — `pronounceError` state exists but not rendered
2. **Pronunciation Flow** — Currently auto-advances after correct/incorrect, should wait for user decision
3. **Stop Recording** — Currently sets `isRecording = false` but doesn't properly abort recognition
4. **Recognition Cleanup** — No cleanup when changing cards or modes
5. **Button Rendering Logic** — Buttons should appear for both correct AND incorrect results
6. **Dashboard Metrics** — Already fixed in 9.10A but need to verify user-scoping
7. **Password Reset** — Need to verify after Supabase configuration

---

## Part 1: Pronunciation Error UI Audit

### Current State

**File:** `components/FlashcardMode.tsx`

**State Declaration (line 199):**
```typescript
const [pronounceError, setPronounceError] = useState<string | null>(null);
```

**Usage in handleStartRecording (lines 604-694):**
- ✅ `setPronounceError` is called in multiple error scenarios
- ✅ Specific error messages defined per error type
- ✅ Error state is reset at start of recording

**Error Messages Defined:**
- `not-allowed` / `permission-denied`: "Vui lòng cho phép truy cập microphone."
- `no-speech`: "Không nghe thấy giọng nói. Hãy thử lại."
- `network`: "Lỗi kết nối. Vui lòng kiểm tra mạng."
- Generic: "Lỗi nhận diện giọng nói. Hãy thử lại."
- No result on end: "Không nghe thấy giọng nói. Hãy thử lại."
- No match: "Không nhận diện được. Hãy nói rõ hơn."
- Unsupported: "Trình duyệt không hỗ trợ nhận diện giọng nói."

### Issue: No UI Rendering

**Search Results:**
- `pronounceError` is declared (line 199)
- `pronounceError` is set in handlers (lines 604-694)
- ❌ **`pronounceError` is NOT rendered in JSX**

**Searched JSX sections:**
- Lines 1150-1450 (Pronunciation mode UI)
- No `{pronounceError &&` pattern found
- No `role="alert"` referencing pronounceError
- No `aria-live` referencing pronounceError

### Expected Behavior

When error occurs:
```
❌ Không nghe thấy giọng nói. Hãy thử lại.
```

UI must:
- Display error message clearly
- NOT show correct/incorrect result
- NOT show decision buttons (Chưa nhớ / Đã thuộc)
- Allow retry
- Clear error when starting new recording

### Recommended Implementation Location

After microphone button, before result display (around line 1360-1375):

```typescript
{pronounceError && (
  <div className="p-4 rounded-2xl bg-red-50 border border-red-200" role="alert" aria-live="polite">
    <div className="flex items-center gap-2 text-red-700 text-sm font-semibold">
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      <span>{pronounceError}</span>
    </div>
  </div>
)}
```

### Accessibility Requirements

- ✅ Must have `role="alert"`
- ✅ Must have `aria-live="polite"`
- ✅ Error text must be readable
- ✅ Icon optional but recommended

---

## Part 2: Pronunciation Flow Audit

### Current Flow Analysis

**File:** `components/FlashcardMode.tsx`

#### Correct Result Flow (lines 1377-1432)

**Current Behavior:**
```typescript
{pronounceSubmitted && (
  <div className="space-y-4 max-w-md mx-auto">
    <div className={`p-4 rounded-2xl border text-center space-y-2 ${
      isPronounceCorrect
        ? 'bg-[#D1FAE5]/40 border-[#059669] text-[#059669]'
        : 'bg-[#FFE4E6]/40 border-[#E11D48] text-[#E11D48]'
    }`}>
      {/* Result display */}
    </div>

    {!isPronounceCorrect && (
      <div className="flex items-center justify-center gap-2 pt-1">
        <button onClick={handleStartRecording}>Nói lại</button>
        <button onClick={() => handleRating(true)}>Bỏ qua</button>
      </div>
    )}
  </div>
)}
```

### Critical Issues Found

#### Issue 1: Buttons Only Show When Incorrect

**Current Logic (line 1414):**
```typescript
{!isPronounceCorrect && (
  // Buttons here
)}
```

**Problem:**
- When `isPronounceCorrect === true` → NO buttons shown
- When `isPronounceCorrect === false` → Shows "Nói lại" and "Bỏ qua"
- "Bỏ qua" button calls `handleRating(true)` which advances to next card

**Expected:**
- BOTH correct and incorrect should show: `[Chưa nhớ]` `[Đã thuộc]`
- Correct pronunciation does NOT auto-advance
- Incorrect pronunciation does NOT auto-advance
- User must explicitly choose "Đã thuộc" to complete

#### Issue 2: "Skip" Button Mapping

**Line 1357-1359:**
```typescript
<button
  onClick={() => {
    setPronounceSubmitted(true);
    setIsPronounceCorrect(true);
  }}
>
  ▷ Bỏ qua chế độ này
</button>
```

**Analysis:**
- This is the initial "skip pronunciation mode" button
- Sets both `pronounceSubmitted = true` and `isPronounceCorrect = true`
- This simulates a correct pronunciation without actually recording
- Should trigger the same two-button UI as real correct pronunciation

**Line 1424-1428:**
```typescript
<button
  onClick={() => handleRating(true)}
  className="..."
>
  Bỏ qua
</button>
```

**Analysis:**
- This "Bỏ qua" appears only when incorrect (`!isPronounceCorrect`)
- Calls `handleRating(true)` directly
- Advances to next card immediately
- This is wrong — should be "Đã thuộc" button instead

#### Issue 3: Missing Buttons When Correct

**Current Behavior:**
1. User speaks correctly
2. `isPronounceCorrect = true`
3. Shows "Chính xác!" message
4. NO buttons appear
5. User is stuck

**Root Cause:**
The condition `{!isPronounceCorrect && ...}` on line 1414 hides buttons when correct.

#### Issue 4: No "Chưa nhớ" Button

**Current State:**
- "Chưa nhớ" button does NOT exist in Pronunciation mode UI
- Only "Nói lại" and "Bỏ qua" exist (for incorrect case only)

**Expected:**
Both correct and incorrect should show:
```
[Chưa nhớ]  [Đã thuộc]
```

Not:
```
[Nói lại]  [Bỏ qua]  // Current incorrect behavior
```

### Required Changes

#### Change 1: Add Buttons for Both Correct and Incorrect

Replace lines 1414-1430 with:

```typescript
{/* Decision buttons - show for BOTH correct and incorrect */}
<div className="flex items-center justify-center gap-2 pt-1">
  <button
    onClick={handleNotRemembered}
    className="px-4 py-2 rounded-xl bg-white border border-[#FCE7F3] text-gray-700 font-bold text-xs hover:bg-[#FFF1F2] cursor-pointer"
  >
    Chưa nhớ
  </button>
  <button
    onClick={() => handleRating(true)}
    className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#ED4F8E] to-[#F472B6] text-white font-bold text-xs hover:opacity-95 cursor-pointer"
  >
    Đã thuộc
  </button>
</div>
```

#### Change 2: Remove Condition Wrapper

The buttons must appear when `pronounceSubmitted === true`, regardless of `isPronounceCorrect` value.

Current:
```typescript
{!isPronounceCorrect && (
  // buttons
)}
```

Should be:
```typescript
{/* Always show when submitted */}
<div>
  // buttons
</div>
```

### Verification Points

After fix:
- [ ] Pronounce correctly → Shows "Chính xác" + [Chưa nhớ] [Đã thuộc]
- [ ] Pronounce incorrectly → Shows "Chưa đúng" + [Chưa nhớ] [Đã thuộc]
- [ ] Click "Chưa nhớ" → Returns to Flashcard same word
- [ ] Click "Đã thuộc" → Reviews and advances to next word
- [ ] NO auto-advance on correct
- [ ] NO auto-advance on incorrect
- [ ] NO auto-rating

---

## Part 3: Stop Recording Audit

### Current Implementation (lines 1363-1375)

```typescript
{isRecording && (
  <div className="space-y-3">
    <button
      onClick={() => setIsRecording(false)}
      className="..."
    >
      <div className="w-6 h-6 bg-white rounded-xs" />
    </button>
    <p className="text-xs font-bold text-[#E11D48]">
      Đang nghe... Bấm để dừng
    </p>
  </div>
)}
```

### Critical Issue: No Recognition Abort

**Problem:**
- Button only sets `setIsRecording(false)`
- Does NOT call `recognition.abort()` or `recognition.stop()`
- Recognition continues running in background
- `onend` or `onresult` callbacks will still fire
- Will trigger "no-speech" error even though user deliberately stopped

### Current Recognition Instance Management

**Search for recognition storage:**
```
recognitionRef
webkitSpeechRecognition
SpeechRecognition
```

**Finding:**
- `recognition` is created as local variable in `handleStartRecording` (line 604-694)
- NOT stored in `useRef`
- NOT accessible outside `handleStartRecording`
- Cannot be aborted from stop button

### Root Cause

The stop button cannot abort recognition because:
1. Recognition instance is local to `handleStartRecording`
2. No ref to store instance
3. No way to call `.abort()` from stop button handler

### Required Changes

#### Change 1: Store Recognition in Ref

Add ref declaration (around line 190-200):

```typescript
const recognitionRef = useRef<SpeechRecognition | null>(null);
const userStoppedRef = useRef(false);
```

#### Change 2: Store Instance When Creating

In `handleStartRecording`, after creating recognition:

```typescript
const recognition = new SpeechRecognitionClass();
recognitionRef.current = recognition;
```

#### Change 3: Create Stop Handler

```typescript
const handleStopRecording = useCallback(() => {
  userStoppedRef.current = true;
  
  if (recognitionRef.current) {
    try {
      recognitionRef.current.abort();
    } catch (err) {
      console.error('Recognition abort error:', err);
    }
    recognitionRef.current = null;
  }
  
  // Reset to initial state
  setIsRecording(false);
  setTranscriptText('');
  setPronounceSubmitted(false);
  setIsPronounceCorrect(null);
  setPronounceError(null);
}, []);
```

#### Change 4: Prevent No-Speech Error After User Stop

In `handleStartRecording`, inside `onend` handler:

```typescript
recognition.onend = () => {
  // User deliberately stopped - don't show error
  if (userStoppedRef.current) {
    userStoppedRef.current = false;
    return;
  }
  
  // If onend fired without onresult, user didn't speak
  if (!hasResult) {
    setIsRecording(false);
    setPronounceSubmitted(false);
    setPronounceError('Không nghe thấy giọng nói. Hãy thử lại.');
  }
};
```

#### Change 5: Update Stop Button

Replace line 1366:

```typescript
onClick={handleStopRecording}
```

### Verification Points

After fix:
- [ ] Click microphone → Starts recording
- [ ] Click stop → Recognition aborts immediately
- [ ] After stop → Returns to initial state (no buttons, no error)
- [ ] After stop → No "no-speech" error appears
- [ ] After stop → Can click microphone again
- [ ] No console errors about callbacks after abort

---

## Part 4: Recognition Cleanup Audit

### Search for Cleanup Logic

**Keywords:**
- `useEffect`
- `currentVocab`
- `currentIndex`
- `subMode`
- `componentWillUnmount`
- `cleanup`
- `return () =>`

### Finding: No Cleanup Effect

**Issue:**
- No `useEffect` cleans up recognition when card changes
- No `useEffect` cleans up recognition when mode changes
- No `useEffect` cleans up on unmount

### Consequences

**Scenario 1: User Changes Card During Recording**
1. User starts recording for word A
2. User somehow advances to word B (e.g., hotkey, external action)
3. Recognition still running for word A
4. `onresult` fires with word A transcript
5. Compares against word B
6. Wrong evaluation

**Scenario 2: User Changes Mode During Recording**
1. User starts recording in Pronunciation mode
2. User presses hotkey to change mode
3. Recognition still running
4. Callback tries to update unmounted component state
5. Console warning or error

**Scenario 3: Component Unmounts**
1. User closes modal or navigates away
2. Recognition still running
3. Callbacks fire after unmount
4. Memory leak + console warnings

### Required Changes

#### Add Cleanup Effect

Around line 700-720:

```typescript
// Cleanup recognition when card or mode changes
useEffect(() => {
  return () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (err) {
        // Ignore - already stopped
      }
      recognitionRef.current = null;
    }
  };
}, [currentVocab?.id, subMode]);
```

#### Reset Pronunciation State When Card Changes

```typescript
useEffect(() => {
  // Reset pronunciation state when changing cards
  setIsRecording(false);
  setTranscriptText('');
  setPronounceSubmitted(false);
  setIsPronounceCorrect(null);
  setPronounceError(null);
  
  // Abort any running recognition
  if (recognitionRef.current) {
    try {
      recognitionRef.current.abort();
    } catch (err) {
      // Ignore
    }
    recognitionRef.current = null;
  }
}, [currentVocab?.id]);
```

### Verification Points

After fix:
- [ ] Start recording word A
- [ ] Press "Next" hotkey
- [ ] Word B appears
- [ ] Word B has clean pronunciation state (no old transcript)
- [ ] Word B has no result from word A
- [ ] No console errors
- [ ] Can record word B normally

---

## Part 5: Dashboard User-Scoped Settings Audit

### Current localStorage Keys (lines 83-97)

```typescript
const [dailyGoal, setDailyGoal] = useState<number>(() => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('vocab_daily_goal');
    if (saved) return parseInt(saved, 10) || 20;
  }
  return 20;
});

const [dailyReviewLimit, setDailyReviewLimit] = useState<number>(() => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('vocab_daily_review_limit');
    if (saved) return parseInt(saved, 10) || 20;
  }
  return 20;
});

const [unlimitedReview, setUnlimitedReview] = useState<boolean>(() => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('vocab_unlimited_review');
    if (saved !== null) return saved === 'true';
  }
  return true;
});
```

### Issue: No User Scoping

**Current Keys:**
- `vocab_daily_goal`
- `vocab_daily_review_limit`
- `vocab_unlimited_review`

**Problem:**
- Keys are global across all users on same browser
- User A sets dailyGoal = 50
- User B logs in → sees dailyGoal = 50 (inherited from A)
- User B changes to 20
- User A logs back in → sees 20 (lost their setting)

### Parent Component Analysis

**File:** `app/app/page.tsx`

Need to check:
1. Does Dashboard receive `userId` prop?
2. Does parent have access to session user ID?
3. Is there an Auth Context available?

### Search for User ID Patterns

**Keywords:**
- `userId`
- `user.id`
- `session.user`
- `useAuth`
- `AuthContext`
- `createClient`
- `getUser`

### Required Changes

#### Option 1: User-Scoped Keys (Preferred)

If parent provides userId:

```typescript
const userId = props.userId || 'anonymous';

const [dailyGoal, setDailyGoal] = useState<number>(() => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(`vocab_daily_goal:${userId}`);
    if (saved) return parseInt(saved, 10) || 20;
  }
  return 20;
});
```

#### Option 2: Get User ID Directly

If no props:

```typescript
const [userId, setUserId] = useState<string | null>(null);

useEffect(() => {
  const loadUser = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id || null);
  };
  loadUser();
}, []);

// Then use userId in localStorage keys
```

#### Update Save Handler

```typescript
const handleSaveGoalSettings = () => {
  const validGoal = Math.min(100, Math.max(1, tempGoal || 20));
  const validReviewLimit = Math.min(999, Math.max(1, tempReviewLimit || 20));
  setDailyGoal(validGoal);
  setDailyReviewLimit(validReviewLimit);
  setUnlimitedReview(tempUnlimited);
  
  if (typeof window !== 'undefined' && userId) {
    localStorage.setItem(`vocab_daily_goal:${userId}`, validGoal.toString());
    localStorage.setItem(`vocab_daily_review_limit:${userId}`, validReviewLimit.toString());
    localStorage.setItem(`vocab_unlimited_review:${userId}`, tempUnlimited.toString());
  }
  setIsGoalModalOpen(false);
};
```

### Verification Points

After fix:
- [ ] User A sets dailyGoal = 50
- [ ] Logout User A
- [ ] Login User B
- [ ] User B sees default (20), not 50
- [ ] User B sets dailyGoal = 10
- [ ] Logout User B
- [ ] Login User A again
- [ ] User A still sees 50, not 10

---

## Part 6: Password Reset Verification

### Supabase Configuration Required

**Dashboard Settings:**
1. Authentication → URL Configuration
2. Site URL: `http://localhost:3000`
3. Redirect URLs:
   - `http://localhost:3000/reset-password`
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/**`

**Environment Variable:**
```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Code Verification (Already Done in 9.10A)

**Files Verified:**
- ✅ `app/reset-password/page.tsx` — Correct implementation
- ✅ `components/AuthEventBridge.tsx` — Sets sessionStorage marker
- ✅ `services/accountService.ts` — Uses correct redirectTo
- ✅ `lib/auth/siteUrl.ts` — Returns correct URL
- ✅ `middleware.ts` — Doesn't block /reset-password

**Status:** Code is correct, only configuration needed.

### Manual Test Plan

1. Ensure dev server runs at `http://localhost:3000`
2. Open incognito window
3. Navigate to `/forgot-password`
4. Enter test email
5. Check email inbox
6. Click reset link in email
7. **Verify:** Opens `/reset-password` (not 404)
8. **Verify:** Shows password reset form
9. Enter new password
10. Submit form
11. **Verify:** Shows success message
12. Click "Đăng nhập"
13. Login with new password
14. **Verify:** Successful login
15. Try old password
16. **Verify:** Login fails

### Expected Result

If 404 still occurs after configuration:
- Document exact URL from email
- Check Supabase email template
- Check network tab for redirect flow
- Investigate further before code changes

**Do NOT modify auth code based on assumptions.**

---

## Summary of Required Changes

### FlashcardMode.tsx

1. **Add Error UI Rendering**
   - Location: After microphone button, before result
   - Component: Alert div with `pronounceError` message
   - Condition: `{pronounceError && ...}`

2. **Fix Button Rendering Logic**
   - Remove: `{!isPronounceCorrect && ...}` condition
   - Show buttons when: `pronounceSubmitted === true`
   - Buttons: `[Chưa nhớ]` `[Đã thuộc]` for BOTH correct and incorrect

3. **Add Recognition Ref**
   - Add: `const recognitionRef = useRef<SpeechRecognition | null>(null)`
   - Add: `const userStoppedRef = useRef(false)`
   - Store instance when creating

4. **Create Stop Handler**
   - New function: `handleStopRecording`
   - Aborts recognition
   - Resets all pronunciation state
   - Sets `userStoppedRef.current = true`

5. **Prevent No-Speech After Stop**
   - Check `userStoppedRef.current` in `onend`
   - Return early if user stopped
   - Don't show error

6. **Add Cleanup Effects**
   - Effect 1: Cleanup on card/mode change
   - Effect 2: Reset state on card change
   - Abort recognition safely

### Dashboard.tsx

1. **Add User ID Management**
   - Get userId from props or auth
   - Use in localStorage keys

2. **Update localStorage Keys**
   - Change: `vocab_daily_goal` → `vocab_daily_goal:${userId}`
   - Change: `vocab_daily_review_limit` → `vocab_daily_review_limit:${userId}`
   - Change: `vocab_unlimited_review` → `vocab_unlimited_review:${userId}`

3. **Update Save Handler**
   - Include userId in all localStorage.setItem calls

### app/app/page.tsx (If Needed)

1. **Pass userId to Dashboard**
   - Get user from session
   - Pass as prop: `<Dashboard userId={user.id} />`

### Password Reset

1. **Configure Supabase Dashboard**
   - Add Redirect URLs
   - Set Site URL
   - Verify environment variable

2. **Manual Test**
   - Follow test plan
   - Document results
   - No code changes unless proven necessary

---

## Files to Modify

1. `components/FlashcardMode.tsx` — 6 changes
2. `components/Dashboard.tsx` — 3 changes  
3. `app/app/page.tsx` — Verify if userId needed
4. Supabase Dashboard — Configuration only

---

## Files to Read Before Implementation

1. `components/FlashcardMode.tsx` — Full file
2. `components/Dashboard.tsx` — Full file
3. `app/app/page.tsx` — Check Dashboard props
4. `lib/supabase/client.ts` — Check if helper exists
5. Existing user-scoped patterns in other components

---

## Testing Checklist

### Pronunciation Mode
- [ ] Correct → Shows result + buttons, no auto-advance
- [ ] Incorrect → Shows result + buttons, no auto-advance
- [ ] Error → Shows error, no buttons
- [ ] Stop → Aborts, resets, no error
- [ ] Change card during recording → Clean state
- [ ] Chưa nhớ → Returns to flashcard same word
- [ ] Đã thuộc → Reviews and advances

### Dashboard
- [ ] User A setting persists for A
- [ ] User B doesn't see A's settings
- [ ] Limited mode displays correctly
- [ ] Unlimited mode displays correctly
- [ ] Metric updates after review

### Password Reset
- [ ] Email sends
- [ ] Link opens /reset-password
- [ ] Form works
- [ ] New password logs in
- [ ] Old password fails

---

**Audit Complete**  
**Ready for Implementation**