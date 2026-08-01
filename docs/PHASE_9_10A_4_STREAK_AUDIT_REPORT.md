# Phase 9.10A.4 — Streak Calculation & UI Audit Report

**Date:** 2026-08-01  
**Branch:** `feat/profile-management`  
**Status:** ✅ AUDIT COMPLETED

---

## Executive Summary

Audit of streak calculation logic and UI display in response to user question about how streak is recorded daily and displayed in Dashboard.

**Findings:**
- ✅ Streak calculation logic is correct and well-implemented
- ✅ UI displays streak in two locations: Navbar and Dashboard
- ✅ Streak counts ANY review activity (both new words AND due reviews)
- ⚠️ Potential edge case: Studying only NEW words may not count toward streak (needs verification)

---

## 1. Streak Calculation Logic

### 1.1 Location
**File:** `services/dashboardService.ts` (lines 164-244)

### 1.2 Algorithm Overview

**Function:** `calculateStudyStreak()`

**Data Source:** `review_logs` table (all review actions)

**Query Strategy:**
```typescript
// Fetch last 365 days of review timestamps in ONE query
const { data: reviews } = await supabase
  .from('review_logs')
  .select('reviewed_at')
  .gte('reviewed_at', startBoundary.toISOString());
```

**Key Features:**
- ✅ Bounded query (max 365 days) prevents infinite growth
- ✅ Single database query for all data
- ✅ Client-side calculation using pure functions
- ✅ Timezone-aware using local date boundaries

### 1.3 Streak Counting Rules

**Step 1: Convert to local date keys**
```typescript
const studiedDates = new Set<string>();
reviews.forEach((review) => {
  const reviewDate = new Date(review.reviewed_at);
  const localDateKey = 'YYYY-MM-DD'; // e.g., "2026-08-01"
  studiedDates.add(localDateKey);
});
```

**Step 2: Start point determination**
```typescript
// Streak must start TODAY or YESTERDAY
if (studiedDates.has(todayKey)) {
  currentDate = today;        // Start from today
} else if (studiedDates.has(yesterdayKey)) {
  currentDate = yesterday;    // Start from yesterday
} else {
  return 0;                   // No recent activity
}
```

**Step 3: Count backwards until gap found**
```typescript
let streak = 0;
for (let i = 0; i < 365; i++) {
  const dateKey = formatDate(currentDate);
  
  if (!studiedDates.has(dateKey)) {
    break; // Streak ends at first missing day
  }
  
  streak++;
  currentDate.setDate(currentDate.getDate() - 1); // Move back one day
}
return streak;
```

### 1.4 What Counts as "Studied"?

**Current Implementation:**
```sql
SELECT reviewed_at FROM review_logs
WHERE reviewed_at >= {365_days_ago}
```

**No filter on `previous_interval_hours`** — means streak counts:
- ✅ New word first studies (previous_interval_hours = 0)
- ✅ Due review actions (previous_interval_hours > 0)
- ✅ ANY review_log entry = activity for that day

**Example:**
```
Day 1: Study 5 new words → 5 review_logs → studiedDates.add('2026-07-30')
Day 2: Review 3 due words → 3 review_logs → studiedDates.add('2026-07-31')
Day 3: Study 2 new + 1 due → 3 review_logs → studiedDates.add('2026-08-01')

Streak = 3 days ✅
```

### 1.5 Edge Cases

**✅ Same-day multiple reviews:**
- Set deduplication ensures each date counted only once
- Studying 100 words on same day = 1 day toward streak

**✅ Timezone handling:**
- Uses `getLocalDayBoundaries()` for consistent local date keys
- User in UTC+7 studying at 11:50 PM = counts for that local day

**✅ Grace period:**
- Allows yesterday as valid start (user hasn't studied yet today)
- Prevents streak reset if user studies later in the day

**⚠️ Potential issue:**
- If query ONLY fetched `previous_interval_hours > 0`, new word studies wouldn't count
- Current implementation fetches ALL review_logs, so this is NOT an issue
- **BUT**: If future Phase modifies Query 4 to filter reviews, this could break

---

## 2. Streak UI Display

### 2.1 Location 1: Navbar (Top Right)

**File:** `components/Navbar.tsx` (lines 148-151)

**Display:**
```tsx
<div className="flex items-center gap-1.5 px-3 py-1.5 
     bg-[#FFF1F2] border border-[#FCE7F3] rounded-2xl">
  <Flame className="w-4 h-4 text-[#F472B6] fill-[#F472B6] animate-pulse" />
  <span>{currentStreak}</span>
</div>
```

**Features:**
- 🔥 Flame icon with pink fill and pulse animation
- Pink badge background (#FFF1F2) with pink border (#FCE7F3)
- Shows raw number (e.g., "7")
- Always visible in top navigation
- Responsive sizing (smaller on mobile)

**Data Source:**
```tsx
// Prop passed from app/app/page.tsx
currentStreak: number  // = dashboardMetrics.studyStreak
```

### 2.2 Location 2: Dashboard Card

**File:** `components/Dashboard.tsx` (lines 374-443)

**Card Structure:**

**Header:**
```tsx
<div className="flex items-center gap-2.5">
  <div className="w-9 h-9 rounded-2xl bg-orange-100 flex items-center justify-center">
    <Flame className="w-5 h-5 fill-orange-500 animate-pulse" />
  </div>
  <span>Chuỗi ngày học tập</span>
</div>

<span className={studyStreak > 0 
  ? 'bg-orange-50 text-orange-600 border-orange-200'  // Active
  : 'bg-gray-50 text-gray-500 border-gray-200'        // Inactive
}>
  {studyStreak > 0 ? '🔥 Hoạt động' : '❄️ Bắt đầu'}
</span>
```

**Main Display:**
```tsx
<span className="text-5xl font-black text-gray-900">
  {dashboardMetrics?.studyStreak || 0}
</span>
<span className="text-lg font-bold text-gray-500">ngày liên tiếp</span>

<p className="text-xs text-gray-500">
  {studyStreak > 0
    ? `Xuất sắc! Bạn đã duy trì thói quen học tập liên tục ${studyStreak} ngày.`
    : 'Học hoặc ôn từ vựng hôm nay để thắp sáng ngọn lửa học tập!'}
</p>
```

**Week Visualization:**
```tsx
{weekDays.map((day) => (
  <div className={`rounded-xl sm:rounded-2xl flex flex-col items-center justify-center
    ${day.isStudied 
      ? 'bg-gradient-to-br from-[#ED4F8E] to-[#F472B6] text-white shadow-md'  // Studied
      : day.isToday
        ? 'bg-white border-2 border-[#ED4F8E] text-[#ED4F8E]'                 // Today
        : 'bg-[#FCE7F3] text-gray-400'                                         // Not studied
    }`}
  >
    <span className="uppercase">{day.label}</span>  {/* T2, T3, ... */}
    {day.isStudied ? (
      <Flame className="w-4 h-4 fill-white text-white" />  {/* 🔥 */}
    ) : day.isToday ? (
      <span className="w-2 h-2 rounded-full bg-[#ED4F8E] animate-ping" />  {/* Pulsing dot */}
    ) : (
      <span>{day.dayNum}</span>  {/* Date number */}
    )}
  </div>
))}
```

**Visual Features:**
- 🔥 Orange flame icon in header (different from navbar's pink)
- Large number display (text-5xl)
- Status badge: "🔥 Hoạt động" (active) or "❄️ Bắt đầu" (inactive)
- Motivational message below number
- 7-day week visualization with gradient backgrounds for studied days
- Flame icons on studied days
- Pulsing dot on today if not yet studied
- Responsive design (smaller on mobile)

---

## 3. Data Flow Summary

```
[1] User studies vocabulary (new or due)
    → updateUserProgress() called
    → RPC creates review_log entry

[2] refreshAppData() triggered
    → getDashboardMetrics() called

[3] getDashboardMetrics() 
    → calculateStudyStreak() called
    → Query: SELECT reviewed_at FROM review_logs (last 365 days)
    → Convert to local date keys (Set<string>)
    → Count consecutive days backwards from today/yesterday
    → Return streak number

[4] Streak passed to UI components
    → app/app/page.tsx receives dashboardMetrics.studyStreak
    → Navbar receives currentStreak prop
    → Dashboard receives dashboardMetrics prop

[5] UI displays streak
    → Navbar: Pink flame badge with number
    → Dashboard: Large card with week visualization
```

---

## 4. Potential Issues & Recommendations

### 4.1 Current Implementation Strengths

✅ **Efficient:** Single bounded query (365 days max)  
✅ **Timezone-aware:** Uses local date boundaries  
✅ **Inclusive:** Counts both new words and reviews  
✅ **Grace period:** Allows yesterday as valid start  
✅ **Deduplication:** Multiple studies same day = 1 day  
✅ **Pure functions:** Easy to test and reason about

### 4.2 Potential Edge Cases

⚠️ **Issue 1: Query dependency**
- **Problem:** Streak query fetches ALL review_logs (no filter)
- **Risk:** If future Phase adds filter to this query (e.g., only due reviews), streak would break
- **Recommendation:** Add explicit comment that Query 4 must remain unfiltered

⚠️ **Issue 2: New words vs reviews semantic**
- **Question:** Should streak count ONLY reviews (due words), or BOTH new + reviews?
- **Current:** Counts BOTH
- **User expectation:** Unclear — might expect streak to require "ôn tập" (reviews), not just "học từ mới" (new words)
- **Recommendation:** Clarify with user

⚠️ **Issue 3: UI consistency**
- **Navbar:** Pink flame (#F472B6)
- **Dashboard:** Orange flame (orange-500)
- **Recommendation:** Consider unifying color scheme for brand consistency

### 4.3 Suggested Tests

**Test A: New words only**
- Day 1: Study 5 NEW words (no reviews)
- Expected: Streak = 1 ✅
- Verify: Does studying only new words count toward streak?

**Test B: Reviews only**
- Day 1: Review 5 DUE words (no new words)
- Expected: Streak = 1 ✅

**Test C: Mixed activity**
- Day 1: Study 3 new + 2 due
- Expected: Streak = 1 ✅

**Test D: Grace period**
- Day 1: Study words
- Day 2: Don't study until 11:59 PM
- Day 3: Check streak at 12:01 AM
- Expected: Streak = 1 (yesterday still counts) ✅

**Test E: Streak break**
- Day 1: Study words (streak = 1)
- Day 2: Don't study
- Day 3: Don't study
- Day 4: Study words
- Expected: Streak = 1 (resets after 2-day gap) ✅

---

## 5. User Question Response

**User asked:** "kiểm tra giúp tôi cách streak được ghi nhận hằng ngày, và UI của streak ở dashboard"

### 5.1 How Streak is Recorded Daily

**Streak counts a day as "studied" if:**
- ✅ User creates at least ONE review_log entry that day (any rating, any word)
- ✅ This includes BOTH new word first studies AND due reviews
- ✅ Multiple studies on same day = still counts as 1 day
- ✅ Timezone-aware: uses user's local date boundaries

**Streak increases when:**
- User studies on consecutive days without gaps
- If user studied yesterday but not yet today → streak remains (grace period)
- If user skips 2+ days → streak resets to 0 (or 1 if they study again)

**Example:**
```
Aug 1: Study 5 words → streak = 1
Aug 2: Study 3 words → streak = 2
Aug 3: Study 10 words → streak = 3
Aug 4: Don't study → streak = 3 (grace period, still counts yesterday)
Aug 5: Don't study → streak = 0 (gap too long, reset)
Aug 6: Study 2 words → streak = 1 (new streak starts)
```

### 5.2 Streak UI in Dashboard

**Two locations:**

**1. Navbar (top right):**
- Small pink badge with flame icon 🔥
- Shows number only (e.g., "7")
- Always visible

**2. Dashboard Card:**
- Large prominent card with:
  - Orange flame icon in header
  - Status badge: "🔥 Hoạt động" (if streak > 0) or "❄️ Bắt đầu" (if streak = 0)
  - Large number display (text-5xl)
  - Motivational message
  - 7-day week visualization:
    - Studied days: Pink gradient background + white flame icon
    - Today (not studied): White background + pulsing pink dot
    - Future/past days: Light pink background + date number

---

## 6. Conclusion

**Streak Calculation:** ✅ Well-implemented, efficient, timezone-aware

**UI Display:** ✅ Two clear locations with good visual feedback

**Potential Clarification Needed:**
- Should streak count ONLY reviews (due words) or BOTH new words + reviews?
- Current implementation counts BOTH — is this user's expectation?

**Recommended Next Step:**
- Confirm with user if current behavior matches expectations
- If user expects streak to count ONLY reviews, modify Query 4 to add filter `.gt('previous_interval_hours', 0)`

---

**End of Report**
