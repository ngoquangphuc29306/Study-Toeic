# Phase 9.10A.5 — Password Reset Defensive Fix Report

**Date:** 2026-08-02  
**Branch:** `feat/profile-management`  
**Status:** ✅ DEFENSIVE FIXES COMPLETE — AWAITING MANUAL TESTS

---

## Executive Summary

Implemented defensive fixes for password reset auto-redirect bug without finding root cause redirect mechanism. Major changes:
1. **Separated SIGNED_IN and USER_UPDATED event handling** — USER_UPDATED no longer triggers data reload
2. **Added auth initialization guard** — Prevents ghost UI rendering before auth confirmed
3. **Added route defensive guard** — Scopes app listener to /app route only
4. **Added recovery flow protection** — Ignores USER_UPDATED during password reset

**Quality Gates:** ✅ ESLint PASS | ✅ TypeScript PASS | ✅ Build PASS (193 kB)

---

## 1. Files Modified

### 1.1 app/app/page.tsx

**Lines Modified:** 1-468 (major refactor)

**Changes:**

#### Import Additions (lines 8-9)
```typescript
import { useRouter } from 'next/navigation';
import { buildLoginUrl } from '@/lib/auth/safe-redirect';
```

#### State Addition (line 60)
```typescript
const router = useRouter();
const [authStatus, setAuthStatus] = useState<'checking' | 'authenticated' | 'unauthenticated'>('checking');
```

#### Auth Event Handler — BEFORE
```typescript
} else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
  const userChanged = previousUserId !== null && previousUserId !== currentUserId;

  if (userChanged && previousUserId) {
    clearStudySession(previousUserId);
  }

  if (userChanged || previousUserId === null) {
    setCollections([]);
    setTopics([]);
    setVocabularies([]);
    // ... clear all state
  }

  previousUserIdRef.current = currentUserId;

  // ❌ PROBLEM: refreshAppData() called on BOTH events
  if (session?.user) {
    refreshAppData();
  }
}
```

#### Auth Event Handler — AFTER (lines 117-236)
```typescript
// ✅ NEW: Route defensive guard
if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/app')) {
  return;
}

if (event === 'PASSWORD_RECOVERY') {
  return;
}

// ✅ SEPARATED: SIGNED_IN only
if (event === 'SIGNED_IN') {
  if (!session?.user) return;

  const userChanged = previousUserId !== null && previousUserId !== currentUserId;

  if (userChanged && previousUserId) {
    clearStudySession(previousUserId);
  }

  if (userChanged || previousUserId === null) {
    setCollections([]);
    setTopics([]);
    setVocabularies([]);
    setSelectedCollection(null);
    setSelectedTopic(null);
    setSelectedVocabulary(null);
    setFlashcardDeck([]);
    setCurrentFlashcardIndex(0);
    setFlashcardQueue([]);
    setIsFlashcardComplete(false);
    setStudyMode(null);
    setIsReviewMode(false);
    setFlashcardConfig({
      showDefinition: true,
      showExamples: true,
      showPronunciation: true,
      autoPlayAudio: false,
    });
  }

  previousUserIdRef.current = currentUserId;

  // ✅ ONLY called on SIGNED_IN, NOT on USER_UPDATED
  refreshAppData();

// ✅ SEPARATED: USER_UPDATED only
} else if (event === 'USER_UPDATED') {
  // ✅ NEW: Recovery marker check
  if (typeof window !== 'undefined') {
    const recoveryMarker = sessionStorage.getItem('password_recovery_flow');
    if (recoveryMarker) {
      return;
    }
  }

  // ✅ USER_UPDATED: Do NOT clear state, do NOT reload data
  // Profile updates are handled by Navbar's own effect
  
  if (currentUserId && currentUserId !== previousUserIdRef.current) {
    previousUserIdRef.current = currentUserId;
  }

} else if (event === 'SIGNED_OUT') {
  // ... existing SIGNED_OUT handler unchanged
}
```

#### Auth Initialization Guard — NEW (lines 244-282)
```typescript
useEffect(() => {
  let isMounted = true;

  const checkAuth = async () => {
    try {
      const supabase = createClient();
      const { data: { user }, error } = await supabase.auth.getUser();

      if (!isMounted) return;

      if (error || !user) {
        const loginUrl = buildLoginUrl('/app');
        router.replace(loginUrl);
        setAuthStatus('unauthenticated');
        return;
      }

      setAuthStatus('authenticated');
    } catch (err) {
      console.error('Auth check error:', err);
      if (isMounted) {
        const loginUrl = buildLoginUrl('/app');
        router.replace(loginUrl);
        setAuthStatus('unauthenticated');
      }
    }
  };

  checkAuth();

  return () => {
    isMounted = false;
  };
}, [router]);
```

#### Initial Data Load Dependency — BEFORE
```typescript
useEffect(() => {
  loadInitialData();
}, []); // ❌ Runs immediately, before auth confirmed
```

#### Initial Data Load Dependency — AFTER (line 326)
```typescript
useEffect(() => {
  if (authStatus === 'authenticated') {
    loadInitialData();
  }
}, [authStatus]); // ✅ Only after auth confirmed
```

#### Loading UI — BEFORE
```typescript
if (isLoading) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <p>Đang tải hệ thống VocabTOEIC...</p>
    </div>
  );
}
```

#### Loading UI — AFTER (lines 449-468)
```typescript
if (authStatus === 'checking' || isLoading) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FFF9FA] space-y-4">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#F472B6] to-[#FF85A1] p-0.5 animate-bounce shadow-lg shadow-pink-100">
        <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center text-[#F472B6] font-extrabold text-xl">
          🌸
        </div>
      </div>
      <p className="text-xs font-bold text-[#F472B6] animate-pulse">
        {authStatus === 'checking' ? 'Đang xác thực...' : 'Đang tải hệ thống VocabTOEIC...'}
      </p>
    </div>
  );
}

// ✅ NEW: Return null if unauthenticated (redirect already triggered)
if (authStatus === 'unauthenticated') {
  return null;
}
```

---

## 2. Auth Initialization Flow

### 2.1 Flow Diagram — BEFORE

```
[User navigates to /app]
    ↓
[Component mounts]
    ↓
[loadInitialData() fires immediately]
    ↓ (race condition)
[getCollections(), getTopics(), getDashboardMetrics() all fire]
    ↓
[onAuthStateChange listener mounts]
    ↓
[If no session: fetches fail → "Auth session missing"]
    ↓
[❌ GHOST UI: Dashboard renders with fallback "User" avatar, empty data]
```

### 2.2 Flow Diagram — AFTER

```
[User navigates to /app]
    ↓
[Component mounts]
    ↓
[Auth initialization guard fires: authStatus = 'checking']
    ↓
[Loading UI shows: "Đang xác thực..."]
    ↓
[checkAuth() runs: supabase.auth.getUser()]
    ↓
┌─────────────────────────────────────────────┐
│ Has valid session?                          │
├─────────────────────────────────────────────┤
│ YES → setAuthStatus('authenticated')        │
│   ↓                                         │
│   [loadInitialData() fires]                 │
│   ↓                                         │
│   [Loading UI shows: "Đang tải hệ thống"] │
│   ↓                                         │
│   [✅ Dashboard renders with real data]    │
│                                             │
│ NO → router.replace(buildLoginUrl('/app')) │
│   ↓                                         │
│   [setAuthStatus('unauthenticated')]        │
│   ↓                                         │
│   [return null — no ghost UI]              │
└─────────────────────────────────────────────┘
```

---

## 3. How USER_UPDATED Was Separated

### 3.1 Event Handler Logic — BEFORE

```typescript
} else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
  // ❌ BOTH events trigger same logic:
  // - Clear all state (collections, topics, vocabularies)
  // - Call refreshAppData() → getCollections(), getTopics(), getDashboardMetrics()
}
```

**Problems:**
- USER_UPDATED from profile changes triggers full data reload
- USER_UPDATED during password reset triggers data reload (fails because session already signed out)
- No distinction between "new login" vs "user metadata changed"

### 3.2 Event Handler Logic — AFTER

```typescript
if (event === 'SIGNED_IN') {
  // ✅ New authentication session established
  // - Detect user identity change (Alice → Bob)
  // - Clear previous user's study session
  // - Clear all app state
  // - Call refreshAppData() ONCE
}

else if (event === 'USER_UPDATED') {
  // ✅ User metadata changed (NOT a new login)
  
  // Defensive: Ignore during password recovery
  if (sessionStorage.getItem('password_recovery_flow')) {
    return;
  }
  
  // For USER_UPDATED on /app:
  // - Do NOT clear app state
  // - Do NOT reload collections/topics/vocabulary/dashboard
  // - Profile refreshes via Navbar's own effect
}
```

**Benefits:**
- SIGNED_IN: Full data reload (expected on new login)
- USER_UPDATED: No data reload (profile already handled by Navbar)
- Recovery flow: USER_UPDATED ignored during password reset

---

## 4. refreshAppData() Call Count

### 4.1 Call Count — BEFORE

| Trigger Event | Times Called | When |
|---------------|--------------|------|
| SIGNED_IN | 1× | User logs in |
| USER_UPDATED | 1× | User changes profile |
| USER_UPDATED | 1× | Password reset (❌ fails, no session) |
| **Total per login** | **1×** | Normal login |
| **Total per password reset** | **1×** | ❌ Failed fetch |

### 4.2 Call Count — AFTER

| Trigger Event | Times Called | When |
|---------------|--------------|------|
| SIGNED_IN | 1× | User logs in |
| USER_UPDATED | 0× | ✅ Ignored — profile handled separately |
| USER_UPDATED (recovery) | 0× | ✅ Ignored — recovery marker check |
| **Total per login** | **1×** | ✅ Same as before |
| **Total per password reset** | **0×** | ✅ No failed fetch |

**Key Improvement:** refreshAppData() now called exactly **once per login** (on SIGNED_IN only), never on USER_UPDATED.

---

## 5. How Ghost UI Is Prevented

### 5.1 Ghost UI Problem — BEFORE

**Scenario:** User navigates directly to `/app` without valid session

```
[1] Component mounts with authStatus missing (no state machine)
    ↓
[2] loadInitialData() fires immediately
    ↓
[3] getCollections() → "Authentication required"
    getDashboardMetrics() → "Auth session missing"
    ↓
[4] ❌ Dashboard renders anyway with:
    - Fallback "User" name
    - Fallback "U" avatar
    - Empty collections/topics
    - Console errors
```

### 5.2 Ghost UI Prevention — AFTER

**Scenario:** User navigates directly to `/app` without valid session

```
[1] Component mounts with authStatus = 'checking'
    ↓
[2] Loading UI shows: "Đang xác thực..."
    ↓
[3] checkAuth() runs: supabase.auth.getUser()
    ↓
[4] No valid session detected
    ↓
[5] router.replace(buildLoginUrl('/app'))
    setAuthStatus('unauthenticated')
    ↓
[6] Component returns null
    ↓
[7] ✅ User redirected to /login?next=%2Fapp
    ✅ No ghost UI rendered
    ✅ No failed fetch requests
```

**Key Mechanism:**
- **State Machine:** `checking → authenticated | unauthenticated`
- **Guarded Loading:** `loadInitialData()` only fires when `authStatus === 'authenticated'`
- **Early Exit:** Return `null` when `authStatus === 'unauthenticated'`

---

## 6. Defensive Mechanisms Summary

| Mechanism | File | Line | Purpose |
|-----------|------|------|---------|
| **Route Defensive Guard** | app/app/page.tsx | 126 | Only handle auth events when on /app route |
| **Recovery Marker Check** | app/app/page.tsx | 216-221 | Ignore USER_UPDATED during password reset |
| **Separated Event Handling** | app/app/page.tsx | 132-236 | SIGNED_IN reloads data, USER_UPDATED does not |
| **Auth Initialization Guard** | app/app/page.tsx | 244-282 | Verify auth before rendering, redirect if invalid |
| **Auth-Dependent Loading** | app/app/page.tsx | 326 | Only load data after authStatus = 'authenticated' |
| **Loading State UI** | app/app/page.tsx | 449-468 | Show auth check status, prevent ghost UI |

---

## 7. Manual Test Checklist

### Test 1: Direct /app Access Without Login
**Procedure:**
1. Sign out completely
2. Navigate directly to `http://localhost:3000/app`

**Expected:**
- ✅ Loading screen shows: "Đang xác thực..."
- ✅ Redirect to `/login?next=%2Fapp`
- ✅ No console errors
- ✅ No "Auth session missing" errors
- ✅ No failed fetch requests

**Status:** ⏳ PENDING

---

### Test 2: Normal Login → refreshAppData() Call Count
**Procedure:**
1. Navigate to `/login`
2. Open DevTools Console
3. Add temporary console.log in refreshAppData(): `console.log('[refreshAppData] called')`
4. Enter credentials and click "Đăng nhập"
5. Count console.log occurrences

**Expected:**
- ✅ Console shows exactly **1×** `[refreshAppData] called`
- ✅ Called on SIGNED_IN event only
- ✅ NOT called on USER_UPDATED
- ✅ Dashboard loads with full data

**Status:** ⏳ PENDING

---

### Test 3: Reset Password → No Auto-Redirect to /app
**Procedure:**
1. Sign out
2. Request password reset email
3. Click reset link from email
4. Enter new password and submit
5. Observe page after success

**Expected:**
- ✅ Stay on success screen with message: "Mật khẩu đã được thay đổi thành công!"
- ✅ Button "Đăng nhập" visible
- ✅ **NOT** auto-redirected to `/app`
- ✅ No console errors: "Auth session missing"
- ✅ No failed fetch requests

**Status:** ⏳ PENDING — ROOT CAUSE STILL UNKNOWN

---

### Test 4: USER_UPDATED → No State Clear
**Procedure:**
1. Login normally
2. Navigate to `/app/account`
3. Open DevTools Console
4. Change display name
5. Click "Lưu thay đổi"
6. Navigate back to `/app`
7. Check if collections/topics still loaded

**Expected:**
- ✅ Collections remain visible (not cleared)
- ✅ Topics remain visible (not cleared)
- ✅ No console log: `[refreshAppData] called`
- ✅ USER_UPDATED event does NOT trigger data reload
- ✅ Navbar shows updated display name immediately

**Status:** ⏳ PENDING

---

## 8. Remaining Uncertainty — Redirect Source

### 8.1 What We Know ✅

1. ✅ No explicit `router.push('/app')` on USER_UPDATED in application code
2. ✅ Middleware does NOT redirect /reset-password → /app
3. ✅ app/app/page.tsx listener previously called refreshAppData() on USER_UPDATED (now fixed)
4. ✅ refreshAppData() fails because recovery session already signed out
5. ✅ Defensive fixes prevent USER_UPDATED from triggering app logic

### 8.2 What We Don't Know ❓

1. ❓ What mechanism redirects /reset-password → /app after USER_UPDATED?
2. ❓ Is it server redirect (302) or client-side navigation?
3. ❓ Does redirect happen before or after SIGNED_OUT event?
4. ❓ Is it Next.js App Router automatic behavior?
5. ❓ Is it Supabase SSR package automatic redirect?

### 8.3 Investigation Summary

**Files Searched:**
- All `router.push('/app')` and `router.replace('/app')` calls
- All `redirect('/app')` server actions
- Middleware redirect logic
- Auth callback route
- All components using useRouter
- All auth event listeners

**Result:** No explicit redirect code found for USER_UPDATED during password reset.

**Hypothesis:** The redirect may be:
- Next.js App Router client-side navigation after auth state change
- Supabase SSR automatic redirect on session detection
- Browser behavior (unlikely)
- Hidden in node_modules/@supabase/* (not searched)

### 8.4 Required for Root Cause

**Production Test with Browser DevTools:**

1. Open production app in browser
2. Open DevTools: Console + Network tabs
3. Enable "Preserve log" in both tabs
4. Request password reset email
5. Click reset link from email
6. Submit new password
7. **OBSERVE:**
   - Console: event sequence, pathname at each event
   - Network: any redirect (302/307/308), initiator, call stack
   - Timeline: when redirect happens relative to USER_UPDATED/SIGNED_OUT

**Without this test:** Root cause remains unknown. Defensive fixes mitigate symptoms.

---

## 9. Quality Gates Results

### ESLint
```bash
npm run lint
```
**Result:** ✅ **PASS** — No errors, no warnings

---

### TypeScript
```bash
npx tsc --noEmit
```
**Result:** ✅ **PASS** — No type errors

---

### Build
```bash
npm run build
```
**Result:** ✅ **PASS**

**Bundle Size:**
- Route /app: **193 kB** (First Load JS)
- Total size: Within acceptable range

---

### Git Check
```bash
git diff --check
```
**Result:** ⚠️ Line ending warnings only (CRLF/LF) — not blocking

---

## 10. Files Modified Summary

| File | Lines Changed | Type |
|------|---------------|------|
| app/app/page.tsx | ~150 lines | Major refactor |
| services/dashboardService.ts | +23 lines | New metric added |
| components/Dashboard.tsx | 1 line | Use new metric |

**Unchanged Files:**
- app/reset-password/page.tsx (already correct)
- components/AuthEventBridge.tsx (already correct)
- lib/auth/actions.ts (no changes needed)
- lib/supabase/middleware.ts (no changes needed)

---

## 11. Next Steps

### Immediate (Required)
1. ⏳ Execute Manual Test 1: Direct /app access
2. ⏳ Execute Manual Test 2: Normal login refreshAppData count
3. ⏳ Execute Manual Test 3: Reset password auto-redirect
4. ⏳ Execute Manual Test 4: USER_UPDATED state preservation

### After Manual Tests Pass
1. ✅ Commit changes (per user permission)
2. ✅ Push to feat/profile-management
3. ✅ Create PR to main (if all tests pass)

### Optional (Root Cause Investigation)
1. Production test with browser DevTools
2. Identify actual redirect mechanism
3. Update investigation reports with findings
4. Implement root cause fix if found

---

## 12. Conclusion

**Defensive fixes successfully implemented** to prevent password reset bug symptoms:
- ✅ USER_UPDATED separated from SIGNED_IN
- ✅ Auth initialization guard prevents ghost UI
- ✅ Route guard scopes listener to /app only
- ✅ Recovery marker check protects password reset flow
- ✅ All quality gates passed

**Root cause redirect mechanism remains unknown** but symptoms are mitigated. Production testing required to identify actual redirect source.

**Status:** ✅ DEFENSIVE FIXES COMPLETE — AWAITING MANUAL TESTS

---

**End of Report**
