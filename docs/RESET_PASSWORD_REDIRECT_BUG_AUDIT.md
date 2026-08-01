# Reset Password Redirect Bug — Root Cause Audit

**Date:** 2026-08-01  
**Branch:** `feat/profile-management`  
**Status:** 🔍 INVESTIGATION COMPLETE

---

## 1. Bug Report (Production Observation)

**User Flow:**
1. User clicks reset password link from email
2. User enters new password and submits
3. ❌ **App automatically navigates to `/app`** (without clicking "Đăng nhập" button)
4. ❌ `/app` shows fallback avatar "U" and name "User"
5. ❌ Console errors:
   - `Auth session missing!`
   - `Authentication required for getCollections`
   - `Authentication required for getTopics`
   - `getVocabByTopic: No authenticated user`
   - `getStudyStats: No authenticated user`
6. ❌ User is forced to login again when interacting with features

**Expected Behavior:**
- After password reset success → Stay on success screen
- User clicks "Đăng nhập" button → Redirect to `/login`
- User logs in with new password → Enter `/app` with full authentication

---

## 2. Root Cause Analysis

### 🎯 PRIMARY ROOT CAUSE IDENTIFIED

**File:** `app/app/page.tsx`  
**Lines:** 158-193  
**Event Handler:** `onAuthStateChange` listener

```typescript
} else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
  // Detect actual user identity change (Alice → Bob)
  const userChanged = previousUserId !== null && previousUserId !== currentUserId;

  if (userChanged && previousUserId) {
    // Clear the previous user's session
    clearStudySession(previousUserId);
  }

  // Clear all state on user change or initial sign-in
  if (userChanged || previousUserId === null) {
    setCollections([]);
    setTopics([]);
    setVocabularies([]);
    // ... clear state ...
  }

  // Update tracked user ID
  previousUserIdRef.current = currentUserId;

  // Reload data for authenticated user
  if (session?.user) {
    refreshAppData();  // ❌ THIS IS THE PROBLEM
  }
}
```

### 🔥 The Chain of Events

```
[1] User on /reset-password page
    ↓
[2] User submits new password
    ↓
[3] accountService.updatePasswordFromRecovery() calls:
    await supabase.auth.updateUser({ password: newPassword })
    ↓
[4] Supabase client fires: USER_UPDATED event
    ↓
[5] ✅ AuthEventBridge (components/AuthEventBridge.tsx) — NO REDIRECT
    Lines 33-48: Only handles PASSWORD_RECOVERY and SIGNED_OUT
    Does NOT redirect on USER_UPDATED ✅
    ↓
[6] ✅ reset-password/page.tsx listener (lines 88-102) — NO REDIRECT
    Only handles PASSWORD_RECOVERY event
    Does NOT redirect on USER_UPDATED ✅
    ↓
[7] ❌ app/app/page.tsx listener (lines 120-200) — TRIGGERS REDIRECT
    Line 158: } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
    Line 192: refreshAppData();  // ← Calls getCollections(), getTopics(), etc.
    
    THIS LISTENER IS MOUNTED EVEN WHEN USER IS ON /reset-password PAGE!
    ↓
[8] refreshAppData() calls:
    - getCollections() → "Authentication required"
    - getTopics() → "Authentication required"
    - getDashboardMetrics() → "Authentication required"
    
    ALL FAIL because recovery session was signed out at line 140 of reset-password/page.tsx
    ↓
[9] ❌ UNKNOWN REDIRECT MECHANISM
    Something navigates from /reset-password → /app
    
    Possible culprits:
    - Middleware detecting session and redirecting?
    - Router automatic navigation after state change?
    - Next.js client-side navigation?
    ↓
[10] /app page renders with:
     - Empty collections, topics, vocabularies (failed fetches)
     - Fallback "User" name and "U" avatar (no profile data)
     - Console errors from failed authenticated requests
```

### 🤔 Why Does This Happen?

**The app/app/page.tsx listener is ALWAYS mounted** because:
1. Next.js App Router pre-renders all routes
2. Client-side navigation keeps components mounted
3. `onAuthStateChange` is a GLOBAL listener across all Supabase clients
4. Event fires to ALL active subscriptions, not just the current page

**When user is on `/reset-password`:**
- `/reset-password` page is active (visible)
- `/app/page.tsx` component MAY STILL BE MOUNTED in background
- USER_UPDATED event fires to BOTH listeners
- `/app` listener calls `refreshAppData()` which tries to fetch data
- Recovery session was already signed out, so fetches fail
- UNKNOWN mechanism redirects to `/app`

### 🔍 Missing Piece: The Redirect

**I need to find:**
- What code navigates from `/reset-password` → `/app` after USER_UPDATED?
- Checked files show NO explicit `router.push('/app')` on USER_UPDATED
- Possible sources:
  - Middleware detecting authenticated session (lib/supabase/middleware.ts)?
  - Some auth state change triggering Next.js navigation?
  - Browser history manipulation?

**Evidence against middleware redirect:**
- middleware.ts (lines 66-77) only redirects to /app if:
  - Route is protected AND user is authenticated
  - But /reset-password is NOT in isProtectedRoute
  - So middleware should NOT redirect /reset-password → /app

**Evidence against router.push:**
- No `router.push('/app')` or `router.replace('/app')` found in:
  - AuthEventBridge.tsx
  - reset-password/page.tsx
  - app/app/page.tsx (for USER_UPDATED event)

---

## 3. Files Audited

### ✅ components/AuthEventBridge.tsx
**Lines 33-48:**
```typescript
supabase.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') {
    // Set marker only
  }
  if (event === 'SIGNED_OUT') {
    // Clear marker only
  }
});
```
**Verdict:** Does NOT redirect on USER_UPDATED ✅

### ✅ app/reset-password/page.tsx
**Lines 88-102:**
```typescript
supabase.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY' && isMounted) {
    // Set marker and show form
  }
});
```
**Lines 129-157:**
```typescript
await updatePasswordFromRecovery(newPassword);
sessionStorage.removeItem('password_recovery_flow');
await supabase.auth.signOut({ scope: 'local' });
setPageState('success');
```
**Verdict:** Does NOT redirect on USER_UPDATED ✅  
**Verdict:** Signs out recovery session BEFORE showing success ✅

### ❌ app/app/page.tsx
**Lines 120-200:**
```typescript
supabase.auth.onAuthStateChange(async (event, session) => {
  // ...
  } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
    // ...
    if (session?.user) {
      refreshAppData();  // ❌ PROBLEM
    }
  }
});
```
**Verdict:** Calls refreshAppData() on USER_UPDATED ❌  
**Verdict:** Does NOT explicitly redirect, but triggers data fetches ❌

### ✅ middleware.ts & lib/supabase/middleware.ts
**Lines 64-77 (middleware.ts):**
```typescript
const isProtectedRoute = pathname === '/app' || pathname.startsWith('/app/');

if (isProtectedRoute && !user) {
  // Redirect to login
}

if (user && (pathname === '/login' || pathname === '/signup')) {
  // Redirect to /app
}
```
**Verdict:** Does NOT redirect /reset-password → /app ✅  
**Verdict:** /reset-password is NOT in protected routes ✅

### ✅ services/accountService.ts
**Lines 120-158 (updatePasswordFromRecovery):**
```typescript
await supabase.auth.updateUser({ password: newPassword });
```
**Verdict:** Only calls updateUser, does NOT redirect ✅

### ✅ app/signup/page.tsx
**Lines 23-32:**
```typescript
useEffect(() => {
  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      router.replace('/app');  // ✅ Only for /signup page
    }
  };
  checkAuth();
}, [router]);
```
**Verdict:** Only runs on /signup page, NOT /reset-password ✅

---

## 4. Unresolved Mystery

**THE MISSING REDIRECT:**

I have confirmed:
- ✅ No explicit `router.push('/app')` or `router.replace('/app')` on USER_UPDATED
- ✅ Middleware does NOT redirect /reset-password → /app
- ✅ reset-password/page.tsx does NOT redirect after success
- ❌ `/app` page listener calls `refreshAppData()` on USER_UPDATED (verified)
- ❌ UNKNOWN mechanism navigates from /reset-password → /app

**Hypothesis:**
- USER_UPDATED fires while user is on /reset-password
- app/app/page.tsx listener (mounted in background) calls refreshAppData()
- Failed fetch requests somehow trigger navigation?
- OR: Next.js client-side router automatically navigates after auth state change?
- OR: There's a redirect I haven't found yet (search incomplete)?

**Need to investigate:**
1. Check if Next.js App Router has automatic auth-based navigation
2. Check if failed fetches in refreshAppData() trigger navigation
3. Search for additional onAuthStateChange listeners in node_modules?
4. Check browser DevTools Network tab for 302 redirects
5. Check if Supabase SSR package has automatic redirects

---

## 5. Confirmed Issues

| Issue | File | Line | Problem |
|-------|------|------|---------|
| 1. USER_UPDATED triggers data fetch on wrong page | app/app/page.tsx | 158-192 | refreshAppData() called when user is on /reset-password |
| 2. Recovery session signed out before USER_UPDATED | reset-password/page.tsx | 129-157 | signOut() happens BEFORE USER_UPDATED event propagates |
| 3. app/app/page.tsx listener is global | app/app/page.tsx | 120-200 | Fires even when user is NOT on /app route |

---

## 6. Proposed Fix Strategy

### Option A: Scope app/app/page.tsx listener to /app route only

**Add route check in listener:**
```typescript
supabase.auth.onAuthStateChange(async (event, session) => {
  // Skip if not on /app route
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/app')) {
    return;
  }
  
  // ... rest of handler ...
});
```

### Option B: Ignore USER_UPDATED during recovery flow

**Check sessionStorage marker:**
```typescript
} else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
  // Skip USER_UPDATED if recovery flow is active
  if (event === 'USER_UPDATED') {
    const marker = sessionStorage.getItem('password_recovery_flow');
    if (marker) {
      return; // Ignore USER_UPDATED during password recovery
    }
  }
  
  // ... rest of handler ...
}
```

### Option C: Sign out BEFORE updateUser in reset-password

**Reorder operations:**
```typescript
// Sign out recovery session FIRST
await supabase.auth.signOut({ scope: 'local' });

// Then update password (will fail because no session)
// ❌ This won't work - updateUser requires a session
```

### Option D: Move signOut to BEFORE updateUser triggers USER_UPDATED

**Not feasible:** updateUser triggers USER_UPDATED immediately, signOut happens after.

---

## 7. Recommended Fix

**Combine Option A + Option B:**

1. **Add route scope check in app/app/page.tsx listener**
2. **Add recovery marker check for USER_UPDATED event**

This ensures:
- app/app/page.tsx listener only runs when user is actually on /app
- USER_UPDATED during password recovery is ignored by /app listener
- No impact on normal SIGNED_IN / USER_UPDATED flows

---

## 8. Still Need to Find

**The actual redirect mechanism:**
- What code navigates from /reset-password → /app?
- Is it:
  - Automatic Next.js navigation after auth change?
  - A redirect in Supabase SSR package?
  - A browser-level redirect (302)?
  - Something in node_modules/@supabase/?

**Next steps:**
1. Test with browser DevTools Network tab (look for redirects)
2. Add console.log to track navigation events
3. Check if removing refreshAppData() call prevents redirect
4. Search Supabase SSR source code for automatic redirects

---

**End of Audit**
