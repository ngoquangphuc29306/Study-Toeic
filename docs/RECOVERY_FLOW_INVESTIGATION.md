# Password Recovery Flow Investigation

**Date**: 2026-08-01  
**Purpose**: Understand actual Supabase password recovery architecture before implementing detection

---

## Current Implementation Analysis

### Existing Auth Listener

**Location**: `app/app/page.tsx` lines 94-158

```typescript
const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
  // Handles: SIGNED_IN, SIGNED_OUT, USER_UPDATED
  // Does NOT handle: PASSWORD_RECOVERY
});
```

**Events Handled**:
- `SIGNED_IN` - Initial sign-in or user switch
- `SIGNED_OUT` - User signs out
- `USER_UPDATED` - User data changes

**Events NOT Handled**:
- `PASSWORD_RECOVERY` - User clicks password reset link

### Auth Callback Route

**Location**: `app/auth/callback/route.ts`

```typescript
export async function GET(request: NextRequest) {
  const code = requestUrl.searchParams.get('code');
  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
    // Redirects to next parameter or /app
  }
}
```

**Purpose**: Handles OAuth callbacks and email confirmation (PKCE flow)

**Not Used For**: Password recovery (uses hash fragments, not query params)

### Supabase Client

**Location**: `lib/supabase/client.ts`

```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(supabaseEnv.url, supabaseEnv.anonKey);
}
```

**Flow Type**: PKCE (default for @supabase/ssr)

---

## Supabase Password Recovery Flow

### Official Flow (from Supabase documentation)

1. **User requests password reset**:
   ```typescript
   await supabase.auth.resetPasswordForEmail(email, {
     redirectTo: 'https://example.com/reset-password'
   });
   ```

2. **Supabase sends email** with recovery link:
   ```
   https://example.com/reset-password#access_token=xxx&type=recovery&...
   ```

3. **User clicks link**:
   - Browser loads `/reset-password` with hash fragment
   - Hash contains: `access_token`, `type=recovery`, `refresh_token`

4. **Supabase client automatically exchanges token**:
   - `@supabase/ssr` detects hash fragment
   - Exchanges token for session
   - Fires `PASSWORD_RECOVERY` event via `onAuthStateChange`

5. **App detects PASSWORD_RECOVERY event**:
   ```typescript
   supabase.auth.onAuthStateChange((event, session) => {
     if (event === 'PASSWORD_RECOVERY') {
       // User is in password recovery flow
       // Safe to show password reset form
     }
   });
   ```

6. **User submits new password**:
   ```typescript
   await supabase.auth.updateUser({ password: newPassword });
   ```

7. **Session becomes normal authenticated session**:
   - Recovery context ends
   - User can use app normally

---

## Key Findings

### 1. PASSWORD_RECOVERY Event IS Available

**Claim in Previous Audit**: "PASSWORD_RECOVERY is unavailable in browser client"

**Reality**: PASSWORD_RECOVERY is exposed through `onAuthStateChange` in browser client.

**Documentation**: Supabase official docs show PASSWORD_RECOVERY in browser examples.

### 2. updateUser() Does NOT Validate Recovery Context

**Claim in Previous Audit**: "updateUser() validates recovery context server-side"

**Reality**: `updateUser({ password })` works for ANY authenticated session:
- Normal signed-in users can change password
- Recovery session users can change password
- No server-side distinction

**Implication**: Cannot rely on updateUser() rejection to detect non-recovery sessions.

### 3. Recovery Detection Requires PASSWORD_RECOVERY Event

**Correct Approach**:
- Listen for `PASSWORD_RECOVERY` event
- Set marker when event fires
- Check marker before showing/submitting reset form
- Clear marker after success/failure/navigation

**Incorrect Approach**:
- Check `getSession()` alone (normal sessions also return session)
- Rely on updateUser() to reject normal sessions (it doesn't)
- Substring match on error messages (fragile, unreliable)

### 4. Current Implementation Gap

**Problem**: `/reset-password` page does NOT listen for PASSWORD_RECOVERY event.

**Current Check**:
```typescript
const { data: { session } } = await supabase.auth.getSession();
if (session) {
  setPageState('ready'); // ❌ Accepts ANY session, not just recovery
}
```

**What Happens**:
1. Normal user signs in
2. Navigates to `/reset-password`
3. Has valid session → form shown
4. Submits new password → updateUser() succeeds
5. **Unauthorized password change**

### 5. Hash Fragment vs Query Parameters

**Recovery Links Use Hash Fragment**:
```
/reset-password#access_token=xxx&type=recovery
```

**Why Hash**:
- Hash fragment processed client-side only
- Not sent to server in HTTP request
- More secure for sensitive tokens

**Not Used**:
- Query parameters (`?code=xxx`) - used for PKCE OAuth flow
- `/auth/callback` route - not involved in password recovery

---

## Required Implementation

### Option 1: Scoped Listener in Reset Page (Recommended)

```typescript
// app/reset-password/page.tsx
useEffect(() => {
  const supabase = createClient();
  let recoveryDetected = false;

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      recoveryDetected = true;
      setPageState('ready');
    } else if (session && !recoveryDetected) {
      // Has session but no PASSWORD_RECOVERY event
      setPageState('expired');
    }
  });

  // Check initial session
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session) {
      setPageState('expired');
    }
    // If session exists, wait for PASSWORD_RECOVERY or timeout
    setTimeout(() => {
      if (!recoveryDetected) {
        setPageState('expired');
      }
    }, 2000);
  });

  return () => subscription.unsubscribe();
}, []);
```

**Pros**:
- Self-contained in reset page
- No global state pollution
- Clear lifecycle

**Cons**:
- Race condition: PASSWORD_RECOVERY might fire before listener mounts
- Need timeout to handle direct navigation

### Option 2: SessionStorage Marker (More Reliable)

```typescript
// app/reset-password/page.tsx
useEffect(() => {
  const supabase = createClient();

  // Check for recovery marker
  const recoveryMarker = sessionStorage.getItem('password_recovery_flow');

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      // Set marker when PASSWORD_RECOVERY fires
      sessionStorage.setItem('password_recovery_flow', 'true');
      setPageState('ready');
    }
  });

  // Initial check
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session) {
      setPageState('expired');
    } else if (recoveryMarker === 'true') {
      setPageState('ready');
    } else {
      // Has session but no recovery marker
      setPageState('expired');
    }
  });

  return () => {
    subscription.unsubscribe();
  };
}, []);

// Clear marker after successful password change
const handleSubmit = async () => {
  await updatePasswordFromRecovery(newPassword);
  sessionStorage.removeItem('password_recovery_flow');
  setPageState('success');
};
```

**Pros**:
- Survives page refresh
- No race condition
- Clear marker lifecycle

**Cons**:
- Need to clear marker on success, logout, error
- SessionStorage cleanup on navigation away

### Option 3: Integrate with Global Listener (Most Robust)

**Problem**: Global listener in `app/app/page.tsx` doesn't handle PASSWORD_RECOVERY.

**Solution**: Extend global listener, route event to reset page.

```typescript
// app/app/page.tsx
const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY') {
    // Set sessionStorage marker for reset page
    sessionStorage.setItem('password_recovery_flow', 'true');
  }
  
  // Existing SIGNED_IN, SIGNED_OUT, USER_UPDATED handling...
});
```

```typescript
// app/reset-password/page.tsx
useEffect(() => {
  const recoveryMarker = sessionStorage.getItem('password_recovery_flow');
  
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session) {
      setPageState('expired');
    } else if (recoveryMarker === 'true') {
      setPageState('ready');
    } else {
      setPageState('expired');
    }
  });
}, []);
```

**Pros**:
- Single source of truth
- No race condition
- Global listener catches PASSWORD_RECOVERY before page loads

**Cons**:
- Reset page depends on app page behavior
- Coupling between pages

---

## Race Condition Analysis

### Scenario: Password Recovery Email Click

**Timeline**:
```
T0: User clicks email link
    URL: /reset-password#access_token=xxx&type=recovery

T1: Next.js loads reset-password page
    React component mounts

T2: useEffect runs
    Registers onAuthStateChange listener

T3: Supabase client detects hash fragment
    Exchanges token for session
    Fires PASSWORD_RECOVERY event

T4: Event listener receives PASSWORD_RECOVERY
    Sets recoveryDetected = true
```

**Race Condition**:
- If T3 < T2: PASSWORD_RECOVERY fires BEFORE listener registered
- Listener never receives event
- Page shows expired state despite valid recovery session

**Mitigation**:
- Use sessionStorage marker set by global listener (Option 3)
- OR check sessionStorage + listen for event with timeout (Option 2)
- OR check hash fragment directly for type=recovery (fragile)

### Scenario: Direct Navigation to /reset-password

**Timeline**:
```
T0: Signed-in user navigates to /reset-password
    No hash fragment
    No PASSWORD_RECOVERY event

T1: Page loads, listener registered
    getSession() returns normal session

T2: Timeout expires
    No PASSWORD_RECOVERY event received
    Show expired state
```

**Expected Behavior**: ✅ Correctly rejects normal session

---

## Recommended Implementation

**Use Option 3: Global Listener + SessionStorage Marker**

**Rationale**:
1. No race condition (global listener catches PASSWORD_RECOVERY early)
2. Single source of truth for auth events
3. SessionStorage survives page refresh
4. Clear marker lifecycle
5. Minimal coupling (sessionStorage is the interface)

**Implementation Steps**:
1. Extend global listener in `app/app/page.tsx` to handle PASSWORD_RECOVERY
2. Set `sessionStorage.setItem('password_recovery_flow', 'true')` on event
3. Clear marker on SIGNED_OUT
4. Reset page checks marker + session
5. Reset page clears marker after success/error
6. Clean up marker on navigation away from reset page

---

## Testing Requirements

### Test 1: Normal Session Direct Access
1. Sign in normally
2. Navigate to `/reset-password`
3. **Expected**: sessionStorage has no recovery marker
4. **Expected**: Page shows expired/invalid state
5. **Expected**: Form is NOT shown

### Test 2: Recovery Email Click
1. Request password reset
2. Click email link
3. **Expected**: PASSWORD_RECOVERY event fires
4. **Expected**: sessionStorage marker set
5. **Expected**: Page shows reset form
6. Submit new password
7. **Expected**: Marker cleared
8. **Expected**: Success state shown

### Test 3: Recovery Email + Page Refresh
1. Click recovery email link
2. Reset form appears
3. Refresh page
4. **Expected**: sessionStorage marker still exists
5. **Expected**: Form still shown (not expired)

### Test 4: Used Recovery Link
1. Use recovery link to change password
2. Marker cleared
3. Click same link again
4. **Expected**: Supabase rejects used token
5. **Expected**: No PASSWORD_RECOVERY event
6. **Expected**: Page shows expired state

---

## Conclusion

**Current Implementation is Insecure**:
- Does not detect PASSWORD_RECOVERY event
- Accepts normal sessions as recovery sessions
- Allows unauthorized password changes

**Correct Implementation Requires**:
- Listen for PASSWORD_RECOVERY event via onAuthStateChange
- Use sessionStorage marker to persist recovery state
- Check marker + session before showing form
- Clear marker after success/failure/navigation
- Handle race condition (event before listener)

**Next Steps**:
1. Implement Option 3 (global listener + sessionStorage)
2. Test all 4 scenarios
3. Document PASSWORD_RECOVERY in code comments
4. Correct previous audit claims about updateUser()

---

**Investigation Date**: 2026-08-01  
**Status**: ⚠️ CRITICAL SECURITY ISSUE CONFIRMED - Implementation Required
