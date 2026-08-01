# Phase 9.6 — Profile Race Condition Fix

**Branch**: `feat/profile-management`  
**Date**: 2026-08-01  
**Status**: ✅ Fixed — Ready for manual testing

---

## 1. Root Cause Confirmed

**Location**: `services/profileService.ts` → `ensureCurrentProfile()`

**Race Condition Flow**:
1. Line 124-129: `SELECT` to check if profile exists
2. Line 131-137: Return if exists
3. Line 143-151: `INSERT` if missing

**Problem**: React Strict Mode invokes effects twice in development. Two concurrent calls to `getCurrentProfile()` both observe missing profile and attempt `INSERT` with same `id`.

**Error**: `409 Conflict — duplicate key value violates unique constraint "profiles_pkey"`

**PostgreSQL Error Code**: `23505`

---

## 2. Concurrent Call Sites Found

### Primary Call Sites
1. **Navbar.tsx** (line ~50): `useEffect` loads profile on mount
2. **AccountSettings.tsx** (line ~60): `useEffect` loads profile on mount

### Race Scenario
1. User opens `/app` route
2. Navbar mounts → calls `getCurrentProfile()`
3. User immediately opens AccountSettings → calls `getCurrentProfile()`
4. Both calls enter `ensureCurrentProfile()` concurrently
5. Both observe missing profile
6. Both attempt `INSERT` → second fails with `23505`

**React Strict Mode amplifies this**: Each effect runs twice, creating 4 concurrent calls instead of 2.

---

## 3. Additional Issue Found

**Location**: `app/app/page.tsx` (line 137-143)

**Issue**: Called `getCurrentProfile()` after `SIGNED_OUT` event

**Problem**:
- No authenticated user exists after sign out
- Unnecessary database call
- Could log spurious errors

**Fixed**: Removed `getCurrentProfile()` call from `SIGNED_OUT` handler

---

## 4. Fix Applied

### Strategy: Atomic Upsert with `ignoreDuplicates`

**File**: `services/profileService.ts` → `ensureCurrentProfile()`

**Before** (non-atomic):
```typescript
// Check if profile exists
const { data: existing } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', user.id)
  .maybeSingle();

if (existing) {
  return mapProfileToUserProfile(user.email, existing, avatarUrl);
}

// Create new profile
const { data: newProfile, error: insertError } = await supabase
  .from('profiles')
  .insert({
    id: user.id,
    display_name: displayName,
    avatar_path: null,
  })
  .select()
  .single();
```

**After** (atomic):
```typescript
// Normalize display_name from auth metadata
const initialDisplayName =
  typeof user.user_metadata?.display_name === 'string'
    ? user.user_metadata.display_name.trim() || null
    : null;

// Atomic upsert with ignoreDuplicates
const { error: upsertError } = await supabase
  .from('profiles')
  .upsert(
    {
      id: user.id,
      display_name: initialDisplayName,
    },
    {
      onConflict: 'id',
      ignoreDuplicates: true, // Do not update if row already exists
    }
  );

// Fetch the profile (either just created or already existing)
const { data: profile, error: selectError } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', user.id)
  .single();
```

---

## 5. Conflict Strategy: `ignoreDuplicates: true`

**Behavior**:
- If profile row with `id` exists: **Do nothing** (no UPDATE)
- If profile row missing: **INSERT** new row
- Multiple concurrent upserts: All succeed, only first creates row

**Key Properties**:
- ✅ Race-safe: No duplicate key errors
- ✅ Idempotent: Safe to call multiple times
- ✅ Preserves existing data: Does not overwrite `display_name` or `avatar_path`
- ✅ Initializes new users: Sets `display_name` from auth metadata

**Why `ignoreDuplicates` and not normal upsert?**

Normal upsert would UPDATE existing row:
```typescript
// ❌ This would overwrite existing display_name
upsert({ id: user.id, display_name: initialDisplayName })
```

User changes display name in AccountSettings → Next profile load would reset it to auth metadata value.

`ignoreDuplicates: true` ensures:
- First call: INSERT with initial display_name
- Subsequent calls: Do nothing, keep user's current display_name

---

## 6. Existing Display Name Preservation

✅ **Preserved**

**Scenario**: User changes display name in AccountSettings

**Before fix**:
1. User sets display_name to "New Name"
2. Page refresh triggers profile load
3. `ensureCurrentProfile()` runs
4. `ignoreDuplicates: true` → No UPDATE
5. display_name remains "New Name"

**No overwrite risk**: Auth metadata value never overwrites existing profile value.

---

## 7. Existing Avatar Path Preservation

✅ **Preserved**

**Why**: `upsert` only includes `id` and `display_name`

```typescript
upsert({
  id: user.id,
  display_name: initialDisplayName,
  // avatar_path NOT included
})
```

**Behavior**:
- New profile: `avatar_path` defaults to NULL (table default)
- Existing profile: `avatar_path` unchanged (ignoreDuplicates)

**No overwrite risk**: Avatar path never included in upsert payload.

---

## 8. SIGNED_OUT Behavior Fixed

**File**: `app/app/page.tsx`

**Before**:
```typescript
if (event === 'SIGNED_OUT') {
  // ... clear state ...
  
  try {
    await getCurrentProfile(); // ❌ Unnecessary call
  } catch {
    // Silent
  }
}
```

**After**:
```typescript
if (event === 'SIGNED_OUT') {
  // ... clear state ...
  
  // Navbar will clear its profile state on next render
  // No need to call getCurrentProfile() after sign out
}
```

**Behavior**:
- ✅ No database call after sign out
- ✅ No authenticated user check after sign out
- ✅ Navbar clears profile state naturally on next render
- ✅ Preserves existing state cleanup logic

---

## 9. Files Modified

### services/profileService.ts
**Changes**:
- Replaced check-then-insert with atomic upsert
- Added `ignoreDuplicates: true` option
- Normalized display_name from auth metadata
- Added SELECT after upsert to fetch profile
- Updated comments explaining race-safety

**Lines changed**: ~30 lines in `ensureCurrentProfile()`

### app/app/page.tsx
**Changes**:
- Removed `getCurrentProfile()` call from SIGNED_OUT handler
- Removed import of `getCurrentProfile`
- Added comment explaining no profile call needed
- Made auth listener callback `async` (already done in Phase 9.6)

**Lines changed**: -6 lines (net removal)

---

## 10. Manual Test Results

⏳ **Pending Manual Verification**

### Required Tests

**Race Condition Tests**:
1. [ ] Delete current user's profile row in database
2. [ ] Open `/app` in development mode (React Strict Mode)
3. [ ] Check Network tab: No `409 Conflict` response
4. [ ] Check Console: No duplicate key error
5. [ ] Check database: Exactly one profile row created
6. [ ] Refresh page 5 times: Still one profile row
7. [ ] Open AccountSettings while Navbar loading: No errors

**Display Name Initialization**:
8. [ ] New user with auth metadata display_name: Initializes correctly
9. [ ] Change display_name in AccountSettings
10. [ ] Refresh page: Changed name preserved (not reset)

**Avatar Preservation**:
11. [ ] Upload avatar
12. [ ] Refresh page: Avatar still displays
13. [ ] Open AccountSettings: Avatar unchanged

**SIGNED_OUT Behavior**:
14. [ ] Sign in as Alice
15. [ ] Open Network tab
16. [ ] Sign out
17. [ ] Confirm no profile request after SIGNED_OUT
18. [ ] Sign in as Bob
19. [ ] Confirm Bob's profile loads correctly

**Existing Users**:
20. [ ] User without profile row: Profile created automatically
21. [ ] User with existing profile: No duplicate created

---

## 11. Quality Gates

### Lint
✅ **PASSED** — 0 errors, 0 warnings
- ESLintIgnoreWarning about .eslintignore (pre-existing, unrelated)

### Typecheck
✅ **PASSED** — 0 type errors
- `npx tsc --noEmit` completed with no output

### Build
✅ **PASSED** — Build successful in 6.1s
- All routes unchanged
- No bundle size changes

### Git Diff Check
⚠️ **Line endings only** (LF → CRLF, cosmetic)

---

## 12. Migration Required?

❌ **NO** — No database schema changes required

**Existing schema already supports the fix**:
- `profiles.id` is PRIMARY KEY (unique constraint exists)
- Supabase upsert with `onConflict: 'id'` uses this constraint
- No new columns, indexes, or constraints needed

---

## 13. Git Status

```
 M app/app/page.tsx               (-6 lines)
 M services/profileService.ts     (+16, -21 lines)
 M components/AccountSettings.tsx (Phase 9.6 changes)
 M components/Navbar.tsx          (Phase 9.6 changes)
?? docs/PHASE_9_6_PROFILE_MANAGEMENT_REPORT.md
?? lib/profile/avatarValidation.ts
?? services/profileErrors.ts
?? supabase/migrations/20260801124424_create_profiles_and_avatars.sql
```

**Modified Files**: 2 files (race condition fix), 2 files (Phase 9.6 UI)  
**New Files**: 5 files (Phase 9.6 implementation)

---

## 14. Commit Status

❌ **NOT COMMITTED** — Manual testing required first

---

## 15. Summary

### Root Cause
- Non-atomic check-then-insert in `ensureCurrentProfile()`
- React Strict Mode double-invokes effects
- Two concurrent calls both attempt INSERT

### Fix Applied
- Replaced with atomic `upsert({ ... }, { ignoreDuplicates: true })`
- Followed by SELECT to fetch profile
- Removed unnecessary `getCurrentProfile()` call after SIGNED_OUT

### Guarantees
✅ Race-safe profile creation  
✅ Idempotent (safe to call multiple times)  
✅ Existing display_name preserved  
✅ Existing avatar_path preserved  
✅ No duplicate key errors  
✅ No 409 Conflict responses  
✅ No unnecessary database calls after sign out  
✅ React Strict Mode compatible  
✅ Production compatible  

### Remaining Work
⏳ Manual testing (21 scenarios)  
⏳ Verify no 409 errors in development  
⏳ Verify profile preservation  
⏳ Commit after successful testing  

---

## 16. Verification Checklist

Before committing, verify:

**Race Condition Fixed**:
- [ ] No 409 Conflict in Network tab
- [ ] No duplicate key error in Console
- [ ] Exactly one profile row created
- [ ] Multiple refreshes don't create duplicates
- [ ] Opening AccountSettings during Navbar load doesn't error

**Data Preservation**:
- [ ] Changed display_name not reset on refresh
- [ ] Uploaded avatar not cleared on refresh
- [ ] Auth metadata display_name initializes for new users

**Sign Out Behavior**:
- [ ] No profile request after SIGNED_OUT
- [ ] New user profile loads correctly after sign in

**Build Quality**:
- [ ] Lint passes
- [ ] Typecheck passes
- [ ] Build succeeds

---

**Fix Complete** ✅  
**Manual Testing Required** ⏳
