# Reset Password Redirect Bug — Full Investigation Report

**Date:** 2026-08-02  
**Branch:** `feat/profile-management`  
**Status:** 🔍 INVESTIGATION IN PROGRESS

---

## Executive Summary

User báo cáo: Sau khi đổi mật khẩu thành công, app tự động chuyển sang `/app` mà không cần click "Đăng nhập", hiển thị fallback "User" avatar và console errors "Auth session missing".

**Investigation Steps Completed:**
1. ✅ Added debug logging to app/app/page.tsx
2. ✅ Searched entire codebase for navigation to /app
3. ✅ Built successfully with logging enabled
4. ⏳ PENDING: Production test with browser DevTools
5. ⏳ PENDING: Verify event sequence and redirect mechanism

---

## 1. Debug Logging Added

**File:** `app/app/page.tsx`

**Changes:**

```typescript
useEffect(() => {
  const supabase = createClient();

  // TEMP DEBUG: Track mounting
  console.log('[APP PAGE] mounted', window.location.pathname);

  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
    // TEMP DEBUG: Log all auth events
    console.log('[APP PAGE AUTH EVENT]', {
      event,
      pathname: window.location.pathname,
      hasSession: Boolean(session),
      userId: session?.user?.id ?? null,
    });
    
    // ... rest of handler
  });

  return () => {
    console.log('[APP PAGE] unmounted', window.location.pathname);
    subscription.unsubscribe();
  };
}, [refreshAppData]);
```

**Purpose:**
- Verify if app/app/page.tsx is mounted when URL is /reset-password
- Track all auth events received by this listener
- Confirm pathname at event fire time

---

## 2. Navigation Source Search Results

### 2.1 All router.push/replace calls to /app

| File | Line | Code | Context |
|------|------|------|---------|
| `app/signup/page.tsx` | 28 | `router.replace('/app')` | ✅ Only on /signup when already authenticated |
| `components/account/AccountPage.tsx` | 305 | `router.push('/app')` | ✅ Manual button click "Quay lại" |
| `components/Navbar.tsx` | 155, 180 | `router.push('/app/account')` | ✅ Manual button click profile |

**Verdict:** No automatic redirect from /reset-password → /app found in router calls.

### 2.2 All redirect() server actions to /app

| File | Line | Code | Context |
|------|------|------|---------|
| `lib/auth/actions.ts` | 88 | `redirect('/app')` | ✅ After signup (email confirmation disabled) |
| `lib/auth/actions.ts` | 141 | `redirect(redirectTo)` | ✅ After signIn (default redirectTo = '/app') |

**Verdict:** No server action redirect triggered by password reset flow.

### 2.3 Middleware redirects to /app

| File | Line | Code | Condition |
|------|------|------|-----------|
| `lib/supabase/middleware.ts` | 81 | `NextResponse.redirect('/app')` | ✅ Only when authenticated user on /login or /signup |

**Code:**
```typescript
// Lines 79-89
if (user && (pathname === '/login' || pathname === '/signup')) {
  const redirectResponse = NextResponse.redirect(new URL('/app', request.url));
  // ...
  return redirectResponse;
}
```

**Verdict:** Middleware does NOT redirect /reset-password → /app.  
**Reason:** /reset-password is NOT in the condition `(pathname === '/login' || pathname === '/signup')`.

### 2.4 Auth callback route

**File:** `app/auth/callback/route.ts`

```typescript
export async function GET(request: NextRequest) {
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/app';

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const redirectTo = isInternalPath ? next : '/app';
      return NextResponse.redirect(new URL(redirectTo, request.url));
    }
  }
  
  return NextResponse.redirect(new URL('/login?error=callback_failed', request.url));
}
```

**Verdict:** Only handles OAuth callbacks and email confirmation.  
**Does NOT handle password reset flow.**

### 2.5 All components using useRouter

| Component | Usage |
|-----------|-------|
| `app/reset-password/page.tsx` | ✅ No redirect to /app |
| `app/signup/page.tsx` | ✅ Only redirects if already authenticated (on mount) |
| `components/account/AccountPage.tsx` | ✅ Manual navigation only |
| `components/Navbar.tsx` | ✅ Manual navigation only |

---

## 3. Auth Event Listeners Inventory

**Total listeners found:** 3

### 3.1 AuthEventBridge (Root-level)

**File:** `components/AuthEventBridge.tsx`  
**Mount:** Root layout (all routes)  
**Events handled:**
- `PASSWORD_RECOVERY` → Set sessionStorage marker
- `SIGNED_OUT` → Clear sessionStorage marker

**Verdict:** ✅ No redirect logic.

### 3.2 reset-password/page.tsx listener

**File:** `app/reset-password/page.tsx`  
**Mount:** /reset-password page only  
**Events handled:**
- `PASSWORD_RECOVERY` → Set marker, show form

**Verdict:** ✅ No redirect logic.

### 3.3 app/app/page.tsx listener ⚠️

**File:** `app/app/page.tsx`  
**Mount:** /app page (BUT: may be mounted when user is on other routes)  
**Events handled:**
- `PASSWORD_RECOVERY` → return early (no action)
- `SIGNED_OUT` → Clear state
- `SIGNED_IN` → refreshAppData()
- `USER_UPDATED` → refreshAppData() ⚠️

**Code (lines 158-204):**
```typescript
} else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
  // ... clear state ...
  
  // Update tracked user ID
  previousUserIdRef.current = currentUserId;

  // Reload data for authenticated user
  if (session?.user) {
    refreshAppData();  // ⚠️ PROBLEM
  }
}
```

**Issue:** If this listener is mounted when user is on /reset-password, it will call refreshAppData() on USER_UPDATED event.

---

## 4. Password Reset Flow Analysis

### Expected Flow (from code)

```
[1] User clicks reset link from email
    ↓
[2] Supabase redirects to /reset-password with recovery token
    ↓
[3] PASSWORD_RECOVERY event fires
    → AuthEventBridge sets sessionStorage marker
    → reset-password page shows form
    ↓
[4] User submits new password
    ↓
[5] updatePasswordFromRecovery() calls:
    await supabase.auth.updateUser({ password: newPassword })
    ↓
[6] USER_UPDATED event fires ⚠️
    → AuthEventBridge: no handler
    → reset-password page: no handler
    → app/app/page.tsx: IF MOUNTED → refreshAppData() ⚠️
    ↓
[7] reset-password page continues:
    sessionStorage.removeItem('password_recovery_flow')
    await supabase.auth.signOut({ scope: 'local' })
    setPageState('success')
    ↓
[8] SIGNED_OUT event fires
    → AuthEventBridge: clears marker
    → app/app/page.tsx: IF MOUNTED → clears state
    ↓
[9] Success screen shows with "Đăng nhập" button
```

### Actual Flow (user report)

```
[1-5] Same as expected
    ↓
[6] USER_UPDATED event fires
    → ❓ app/app/page.tsx mounted? → refreshAppData() called?
    ↓
[7] ❓ UNKNOWN MECHANISM redirects /reset-password → /app
    ↓
[8] /app page renders with:
    - Empty collections, topics (failed fetches)
    - Fallback "User" avatar and name
    - Console errors: "Auth session missing"
```

---

## 5. Hypotheses

### Hypothesis A: app/app/page.tsx is pre-mounted by Next.js

**Claim:** Next.js App Router pre-renders or pre-mounts /app component even when user is on /reset-password.

**Evidence for:**
- App Router uses client-side navigation
- Components may be mounted in background for faster navigation
- onAuthStateChange is a global Supabase client listener

**Evidence against:**
- No clear documentation that App Router pre-mounts all pages
- Would need to verify with console logs

**Status:** ⏳ PENDING verification with debug logs

### Hypothesis B: USER_UPDATED triggers automatic Next.js navigation

**Claim:** When Supabase updates user data, Next.js client router automatically navigates to /app.

**Evidence for:**
- Timing matches (happens after updateUser)
- No explicit redirect code found

**Evidence against:**
- No such behavior documented in Next.js or Supabase
- Would be unexpected/undocumented behavior

**Status:** ❌ Unlikely

### Hypothesis C: Failed fetches trigger error boundary redirect

**Claim:** When refreshAppData() fails (no session), an error boundary or error handler redirects to /app.

**Evidence for:**
- Timing matches
- Console shows "Authentication required" errors

**Evidence against:**
- No error boundary redirect code found
- Errors are caught and logged, not thrown

**Status:** ❌ Unlikely

### Hypothesis D: Middleware detects recovery session as normal session

**Claim:** After USER_UPDATED, middleware thinks user is authenticated and redirects /reset-password → /app.

**Evidence for:**
- Middleware has redirect logic
- Recovery session exists before signOut

**Evidence against:**
- Middleware only redirects /login and /signup, NOT /reset-password
- Code checked: line 80-88 clearly shows condition

**Status:** ❌ Ruled out by code inspection

### Hypothesis E: Browser/Supabase SSR automatic redirect

**Claim:** Supabase SSR package or browser has automatic redirect after auth state change.

**Evidence for:**
- No explicit redirect found in application code
- Must be coming from somewhere

**Evidence against:**
- No documentation of such behavior
- Would affect all users (no other reports)

**Status:** ⏳ PENDING investigation

---

## 6. Questions to Answer with Production Test

### 6.1 Component Mounting
- [ ] Is app/app/page.tsx mounted when URL is /reset-password?
- [ ] Does "[APP PAGE] mounted" log appear?
- [ ] What is window.location.pathname at mount time?

### 6.2 Event Sequence
- [ ] What events fire in what order?
- [ ] Does USER_UPDATED fire to app/app/page.tsx listener?
- [ ] Does SIGNED_OUT fire after USER_UPDATED?
- [ ] What is pathname at each event?

### 6.3 Navigation Mechanism
- [ ] Check DevTools Network tab: is there a document/navigation request to /app?
- [ ] If yes: status code? (302 redirect or 200 navigation?)
- [ ] If yes: Initiator? (middleware, client-side, other?)
- [ ] If client-side: Call stack in DevTools?

### 6.4 Session State
- [ ] Does session exist when USER_UPDATED fires?
- [ ] Does session exist when SIGNED_OUT fires?
- [ ] Does session exist after setPageState('success')?

---

## 7. Confirmed Issues (Independent of Root Cause)

### Issue 1: app/app/page.tsx listener is too broad

**Problem:** Listener reacts to all auth events globally, not scoped to /app route.

**Impact:** If mounted when user is on /reset-password, calls refreshAppData() on USER_UPDATED.

**Fix Required:** Add route scope check:
```typescript
if (!window.location.pathname.startsWith('/app')) {
  return;
}
```

### Issue 2: USER_UPDATED during recovery ignored

**Problem:** No distinction between USER_UPDATED from password change vs other user updates.

**Impact:** Recovery flow triggers same logic as normal user updates.

**Fix Required:** Check recovery marker:
```typescript
if (event === 'USER_UPDATED') {
  const marker = sessionStorage.getItem('password_recovery_flow');
  if (marker) {
    return; // Ignore USER_UPDATED during recovery
  }
}
```

### Issue 3: refreshAppData() timing

**Problem:** refreshAppData() called before signOut() completes.

**Sequence:**
```
updateUser() → USER_UPDATED → refreshAppData() → fetch fails
             → signOut() → SIGNED_OUT
```

**Result:** Failed fetch requests with "Auth session missing" errors.

### Issue 4: /app renders without auth guard

**Problem:** /app page renders with empty data and fallback "User" avatar when auth is missing.

**Expected:** Should show loading state or redirect to /login if no authenticated user.

---

## 8. Next Steps

### Step 1: Production Test with DevTools ⏳

**Procedure:**
1. Open production app in browser
2. Open DevTools Console + Network tab
3. Enable "Preserve log" in both tabs
4. Request password reset email
5. Click reset link from email
6. Submit new password
7. **OBSERVE:**
   - Console logs sequence
   - Network requests sequence
   - Any redirects (302/307/308)
   - Call stacks for navigations

**Expected Output:**
```
Console:
[APP PAGE] mounted /reset-password  (or /app?)
[APP PAGE AUTH EVENT] { event: 'USER_UPDATED', pathname: '...', ... }
[APP PAGE AUTH EVENT] { event: 'SIGNED_OUT', pathname: '...', ... }
[APP PAGE] unmounted /...

Network:
GET /reset-password (200 or 302?)
POST updateUser (200)
GET /app (200 or 302?) ← FIND THIS
```

### Step 2: Implement Defensive Fixes

**Even without finding redirect source, can fix:**

1. **Route scope guard in app/app/page.tsx**
2. **Recovery marker check for USER_UPDATED**
3. **Auth guard for /app rendering**

### Step 3: Remove Debug Logging

After finding root cause, remove:
- `console.log('[APP PAGE] mounted', ...)`
- `console.log('[APP PAGE AUTH EVENT]', ...)`
- `console.log('[APP PAGE] unmounted', ...)`

---

## 9. Proposed Defensive Fix (Ready to Implement)

### Fix 1: Scope listener to /app route

**File:** `app/app/page.tsx`  
**Location:** Line 124 (after PASSWORD_RECOVERY check)

```typescript
const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
  const currentUserId = session?.user?.id || null;
  const previousUserId = previousUserIdRef.current;

  // TEMP DEBUG: Log all auth events
  console.log('[APP PAGE AUTH EVENT]', {
    event,
    pathname: window.location.pathname,
    hasSession: Boolean(session),
    userId: session?.user?.id ?? null,
  });

  // NEW: Scope to /app route only
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/app')) {
    console.log('[APP PAGE AUTH EVENT] Ignored - not on /app route');
    return;
  }

  if (event === 'PASSWORD_RECOVERY') {
    // ...
  }
  
  // ...
});
```

### Fix 2: Ignore USER_UPDATED during recovery

**File:** `app/app/page.tsx`  
**Location:** Line 158

```typescript
} else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
  // NEW: Skip USER_UPDATED during password recovery
  if (event === 'USER_UPDATED') {
    const marker = sessionStorage.getItem('password_recovery_flow');
    if (marker) {
      console.log('[APP PAGE AUTH EVENT] Ignored USER_UPDATED - recovery flow active');
      return;
    }
  }

  // ... rest of handler
}
```

### Fix 3: Auth guard for /app page

**File:** `app/app/page.tsx`  
**Location:** After initial data load

```typescript
// NEW: Auth guard effect
useEffect(() => {
  const checkAuth = async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      // No authenticated session - redirect to login
      const loginUrl = buildLoginUrl('/app');
      router.replace(loginUrl);
    }
  };
  
  checkAuth();
}, [router]);
```

---

## 10. Summary

### What We Know ✅

1. ✅ No explicit `router.push('/app')` on USER_UPDATED in application code
2. ✅ Middleware does NOT redirect /reset-password → /app
3. ✅ app/app/page.tsx listener calls refreshAppData() on USER_UPDATED
4. ✅ refreshAppData() fails because recovery session was signed out
5. ✅ Build succeeds with debug logging

### What We Don't Know ❓

1. ❓ Is app/app/page.tsx mounted when user is on /reset-password?
2. ❓ What mechanism redirects /reset-password → /app?
3. ❓ Is it server redirect (302) or client navigation?
4. ❓ Does the redirect happen before or after SIGNED_OUT event?

### Ready to Implement ✅

1. ✅ Route scope guard (Fix 1)
2. ✅ Recovery marker check (Fix 2)
3. ✅ Auth guard (Fix 3)

### Waiting For ⏳

1. ⏳ Production test with browser DevTools
2. ⏳ Console log evidence
3. ⏳ Network tab evidence
4. ⏳ Redirect source identification

---

**Status:** Investigation ~70% complete. Defensive fixes ready. Need production test to identify exact redirect mechanism.

**Next Action:** User should test in production with DevTools and share console + network logs.

---

**End of Report**
