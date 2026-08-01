# Streak Synchronization Audit

**Date**: 2026-08-01  
**Issue**: Dashboard and Navbar display different streak values  
**Status**: Audit Complete

---

## Root Cause Analysis

### Problem
- **Dashboard displays**: `dashboardMetrics.studyStreak` = 1 (real Supabase data)
- **Navbar displays**: `stats.dailyStreak` = 0 (backward-compatible stub)

### Root Cause
**Two independent streak sources**:

1. **Navbar Source**: `stats.dailyStreak`
   - Created in `app/app/page.tsx` line 54-61
   - Populated by `getStudyStats()` from `vocabService.ts`
   - `getStudyStats()` hardcodes `dailyStreak: 0` (line 421)
   - Phase 7 comment: "Replaced by dashboardService"

2. **Dashboard Source**: `dashboardMetrics.studyStreak`
   - Fetched internally by Dashboard component (line 79-111)
   - Calls `getDashboardMetrics()` from `dashboardService.ts`
   - Real Supabase calculation via `calculateStudyStreak()` (line 124)
   - Returns actual consecutive-days streak from `review_logs` table

### Why They Differ
- `vocabService.getStudyStats()` returns stub value `dailyStreak: 0`
- `dashboardService.getDashboardMetrics()` returns real value `studyStreak: 1`
- Navbar and Dashboard read from different sources
- No data flow between them

---

## Current Architecture

### Data Flow (Broken)
```
app/app/page.tsx
    ↓ (calls getStudyStats)
vocabService.getStudyStats() → stats.dailyStreak = 0
    ↓
Navbar → displays stats.dailyStreak = 0 ❌

Dashboard (internal)
    ↓ (calls getDashboardMetrics)
dashboardService.getDashboardMetrics() → studyStreak = 1
    ↓
Dashboard → displays studyStreak = 1 ✅
```

### File Locations

**app/app/page.tsx** (line 54-61):
```typescript
const [stats, setStats] = useState<StudyStats>({
  totalWords: 0,
  masteredCount: 0,
  learningCount: 0,
  newCount: 0,
  dailyStreak: 3, // ← Hard-coded default, replaced by getStudyStats()
  todayStudiedCount: 0,
});
```

**app/app/page.tsx** (line 79, 188):
```typescript
// Called twice: initial load + refreshAppData
const fetchedStats = await getStudyStats(); // ← Returns dailyStreak: 0
setStats(fetchedStats);
```

**services/vocabService.ts** (line 386-424):
```typescript
export async function getStudyStats(): Promise<StudyStats> {
  // Phase 7: Stats are now computed in dashboardService from Supabase
  // This function kept for backward compatibility but should be replaced
  
  return {
    totalWords,
    masteredCount,
    learningCount,
    newCount: Math.max(0, totalWords - (masteredCount + learningCount)),
    dailyStreak: 0, // ← Phase 7: Replaced by dashboardService
    todayStudiedCount: 0, // ← Phase 7: Replaced by dashboardService
  };
}
```

**components/Navbar.tsx** (line 14, 148):
```typescript
interface NavbarProps {
  stats: StudyStats; // ← Contains dailyStreak
}

<span>{stats.dailyStreak} Ngày Streak</span> // ← Displays 0
```

**components/Dashboard.tsx** (line 73-111):
```typescript
// Dashboard owns dashboardMetrics internally
const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);

useEffect(() => {
  const loadMetrics = async () => {
    const metrics = await getDashboardMetrics(); // ← Real Supabase call
    setDashboardMetrics(metrics);
  };
  loadMetrics();
}, [vocabularies]);
```

**components/Dashboard.tsx** (line 365-383):
```typescript
{(dashboardMetrics?.studyStreak || 0) > 0 ? ... }
<span>{dashboardMetrics?.studyStreak || 0}</span> // ← Displays 1
```

**services/dashboardService.ts** (line 22, 124-134):
```typescript
export interface DashboardMetrics {
  studyStreak: number; // ← Real calculated value
}

const streak = await calculateStudyStreak(supabase, now);

return {
  studyStreak: streak, // ← Real consecutive-days count
};
```

---

## Authoritative Source

**Real streak calculation**: `dashboardService.calculateStudyStreak()`

**Algorithm** (line 147-223):
1. Query `review_logs` for last 365 days
2. Extract unique local date keys
3. Check if user studied today OR yesterday
4. Count consecutive days backward until gap found
5. Return streak count

**Properties**:
- ✅ Real Supabase data
- ✅ User-scoped via RLS
- ✅ Timezone-aware (local date boundaries)
- ✅ Performance: ONE bounded query (not N queries)
- ✅ Tested in Phase 7

---

## StudyStats.dailyStreak Status

**Current usage**:
- `lib/types.ts` line 75: Defined in StudyStats interface
- `app/app/page.tsx` line 59, 128, 159: Set to 0 (stub value)
- `components/Navbar.tsx` line 148: Read and displayed
- `services/vocabService.ts` line 421: Returned as 0

**Is it still needed?**
- ❌ **No longer authoritative** — Phase 7 replaced it
- ⚠️ **Still used by Navbar** — but displays wrong value
- ⚠️ **Other components may reference it** — need to verify

**Safe to remove?**
- Not yet — Navbar currently depends on `stats.dailyStreak`
- After fix: Can be deprecated/removed if no other references exist

---

## Dashboard Refresh Behavior

**Current triggers** (line 111):
```typescript
useEffect(() => {
  loadMetrics(); // Calls getDashboardMetrics()
}, [vocabularies]); // ← Reloads when vocabularies array changes
```

**When vocabularies changes**:
- User adds/deletes vocabulary
- User completes flashcard session (calls `updateUserProgress`)
- Parent calls `refreshAppData()` which fetches vocabularies
- Dashboard detects vocabularies change → refetches metrics

**Result**: Dashboard metrics stay fresh after study actions ✅

---

## Account-Switch Behavior

**Current implementation** (app/app/page.tsx line 100-177):

**On SIGNED_OUT** (line 113-137):
```typescript
if (event === 'SIGNED_OUT') {
  setStats({
    totalWords: 0,
    masteredCount: 0,
    learningCount: 0,
    newCount: 0,
    dailyStreak: 0, // ← Cleared immediately
    todayStudiedCount: 0,
  });
  // ... clear other state
}
```

✅ **Navbar streak clears immediately** (no flash of previous user's data)

**On SIGNED_IN** (line 138-171):
```typescript
if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
  const userChanged = previousUserId !== null && previousUserId !== currentUserId;
  
  if (userChanged || previousUserId === null) {
    setStats({ /* all zeros */ });
  }
  
  if (session?.user) {
    refreshAppData(); // ← Fetches new user's data
  }
}
```

✅ **New user's stats fetched after sign-in**

**Dashboard behavior**:
- Dashboard loads metrics independently (not coordinated with parent)
- Dashboard refetches when `vocabularies` changes
- After sign-in → parent calls `refreshAppData()` → vocabularies updates → Dashboard refetches
- ✅ Eventually consistent, but not immediate

---

## Fix Strategy

### Single Source of Truth
Move ownership of `dashboardMetrics` and `weekActivity` from Dashboard to parent (`app/app/page.tsx`).

### Preferred Data Flow
```
dashboardService.getDashboardMetrics()
            ↓
       app/app/page.tsx
        ↙             ↘
Navbar currentStreak  Dashboard dashboardMetrics
```

### Changes Required

1. **app/app/page.tsx**:
   - Add state: `dashboardMetrics`, `weekActivity`, `isLoadingDashboardMetrics`
   - Call `getDashboardMetrics()` and `getWeekActivity()` in initial load
   - Call `getDashboardMetrics()` and `getWeekActivity()` in `refreshAppData()`
   - Extract `currentStreak = dashboardMetrics?.studyStreak ?? 0`
   - Pass `currentStreak` to Navbar
   - Pass `dashboardMetrics`, `weekActivity`, `isLoadingMetrics` to Dashboard
   - Clear dashboard metrics on SIGNED_OUT

2. **components/Navbar.tsx**:
   - Add prop: `currentStreak: number`
   - Replace `{stats.dailyStreak}` with `{currentStreak}`
   - Remove dependency on `stats.dailyStreak`

3. **components/Dashboard.tsx**:
   - Add props: `dashboardMetrics`, `weekActivity`, `isLoadingMetrics`
   - Remove internal state: `dashboardMetrics`, `weekActivity`, `isLoadingMetrics`
   - Remove internal `useEffect` that calls `getDashboardMetrics()`
   - Use props instead of state throughout component

4. **StudyStats.dailyStreak** (optional cleanup):
   - Verify no other components use it
   - If safe, remove from interface
   - Update all references

---

## Refresh Integration

**Current central refresh function**: `refreshAppData()` (app/app/page.tsx line 73-88)

**Current calls**:
```typescript
const [fetchedCols, fetchedTopics, fetchedVocab, fetchedStats] = await Promise.all([
  getCollections(),
  getTopics(),
  getVocabByTopic('all'),
  getStudyStats(), // ← Replace this
]);
```

**After fix**:
```typescript
const [fetchedCols, fetchedTopics, fetchedVocab, fetchedStats, fetchedMetrics, fetchedWeek] = await Promise.all([
  getCollections(),
  getTopics(),
  getVocabByTopic('all'),
  getStudyStats(), // ← Keep for now (other stats)
  getDashboardMetrics(), // ← Add
  getWeekActivity(), // ← Add
]);
```

**Result**: One coordinated refresh for all data ✅

---

## Risk Assessment

### Low Risk
- ✅ Fix is localized to 3 files
- ✅ No database schema changes
- ✅ No new API calls (just moving ownership)
- ✅ Authoritative source already exists and tested
- ✅ No breaking changes to other components

### Medium Risk
- ⚠️ Dashboard currently refetches when `vocabularies` changes
- ⚠️ After fix, must ensure parent refetches dashboard metrics at same time
- Mitigation: Add dashboard metrics to `refreshAppData()` Promise.all

### No Risk
- ✅ Account-switch already clears state correctly
- ✅ Existing refresh logic already coordinates data
- ✅ RLS already enforces user isolation

---

## Next Steps

1. ✅ Audit complete
2. ⏳ Implement fix in app/app/page.tsx
3. ⏳ Update Navbar.tsx
4. ⏳ Update Dashboard.tsx
5. ⏳ Run quality gates
6. ⏳ Manual testing (18 scenarios)
7. ⏳ Generate final report

---

**Audit Complete** ✅  
**Ready for Implementation** ✅
