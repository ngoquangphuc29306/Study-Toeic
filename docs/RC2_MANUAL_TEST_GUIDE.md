# RC2 Manual Test Guide

**Purpose**: Verify RC2 fix eliminates duplicate login load without breaking any existing functionality

**Test Date**: 2026-08-02  
**Branch**: feat/profile-management  
**Fix**: Remove `refreshAppData()` from SIGNED_IN handler

---

## Setup Instructions

### 1. Start Development Server

```bash
npm run dev
```

### 2. Open Browser DevTools

1. Open Chrome/Edge DevTools (F12)
2. Go to **Console** tab
3. Keep console visible during all tests
4. Look for `[RC2-perf]` markers

### 3. Monitor Network Requests

1. Go to **Network** tab
2. Filter by "Fetch/XHR"
3. Keep track of request counts
4. Clear network log before each test scenario

---

## Test 1: Fresh Login (Normal Flow)

### Purpose
Verify login only loads data once (no duplicate)

### Steps

1. **Clear State**:
   - Open `/login` in **incognito window**
   - Or clear all cookies/localStorage
   - Verify completely logged out

2. **Open Console**:
   - Keep Console tab visible
   - Clear console log

3. **Login**:
   - Enter valid credentials
   - Click "Đăng nhập"
   - Wait for redirect to `/app`

4. **Verify Console Output**:
   ```
   Expected:
   [RC2-perf] loadInitialData: 1
   
   NOT Expected:
   [RC2-perf] loadInitialData: 2
   [RC2-perf] refreshAppData: 1
   ```

5. **Verify Network Tab**:
   - Count total API requests to Supabase
   - Expected: ~20 requests (1 auth + 19 data queries)
   - NOT Expected: ~40 requests (duplicate load)

6. **Verify Dashboard**:
   - Collections appear
   - Topics appear
   - Vocabulary counts correct
   - Stats correct
   - No "Auth session missing" error
   - No ghost "User" or "U" avatar

### ✅ Pass Criteria
- Console shows `loadInitialData: 1` ONLY
- Network shows ~20 requests (not 40)
- Dashboard loads correctly
- No errors in console

---

## Test 2: Page Refresh at /app

### Purpose
Verify refresh behavior unchanged (should still load once)

### Steps

1. **Prerequisites**:
   - Already logged in
   - At `/app` route
   - Dashboard fully loaded

2. **Clear Console**:
   - Clear console log
   - Keep Network tab open

3. **Refresh Page**:
   - Press F5 or Ctrl+R
   - Wait for page to reload

4. **Verify Console Output**:
   ```
   Expected:
   [RC2-perf] loadInitialData: 1
   
   NOT Expected:
   [RC2-perf] loadInitialData: 2
   [RC2-perf] refreshAppData: 1
   ```

5. **Verify Behavior**:
   - Page reloads successfully
   - Dashboard shows same data
   - No redirect to login
   - No empty Dashboard state

### ✅ Pass Criteria
- Console shows `loadInitialData: 1` ONLY
- Session persists (no re-login)
- Data loads correctly
- No duplicate load

---

## Test 3: User A → User B Switch

### Purpose
Verify user switching clears state and loads new user data once

### Steps

1. **Login as User A**:
   - Login with User A credentials
   - Note User A's profile name, avatar
   - Note User A's collections/topics

2. **Logout**:
   - Click profile → Sign Out
   - Verify redirect to `/login`
   - Verify console shows state cleared

3. **Clear Console**:
   - Clear console log
   - Keep Network tab open

4. **Login as User B**:
   - Enter User B credentials
   - Click "Đăng nhập"
   - Wait for redirect to `/app`

5. **Verify Console Output**:
   ```
   Expected:
   [RC2-perf] loadInitialData: 1
   
   NOT Expected:
   [RC2-perf] loadInitialData: 2
   ```

6. **Verify User B Data**:
   - Profile shows User B name/avatar
   - Collections are User B's collections (NOT User A)
   - Topics are User B's topics
   - Vocabulary counts are User B's counts
   - No User A data visible

7. **Verify Study Session Cleared**:
   - Open DevTools → Application → Local Storage
   - Check for any User A study session keys
   - Should be cleared (no `flashcard_session_{userA.id}`)

### ✅ Pass Criteria
- Console shows `loadInitialData: 1` for User B
- No User A data visible
- Study session properly cleared
- User B data loads correctly once

---

## Test 4: Logout

### Purpose
Verify logout clears state without data calls

### Steps

1. **Prerequisites**:
   - Logged in at `/app`
   - Dashboard fully loaded

2. **Clear Console**:
   - Clear console log
   - Keep Network tab open

3. **Logout**:
   - Click profile menu
   - Click "Đăng xuất"
   - Wait for redirect

4. **Verify Console Output**:
   ```
   Expected:
   (No [RC2-perf] markers - no data loads)
   
   NOT Expected:
   [RC2-perf] loadInitialData: 1
   [RC2-perf] refreshAppData: 1
   ```

5. **Verify Behavior**:
   - Redirected to `/login`
   - No data API calls in Network tab
   - State cleared (check localStorage)

6. **Verify No Ghost State**:
   - Open `/app` directly in address bar
   - Should redirect to `/login`
   - Should NOT show:
     - Ghost User/U avatar
     - "Auth session missing" error
     - Empty Dashboard with user name

### ✅ Pass Criteria
- No data loads on logout
- Redirect to login works
- State fully cleared
- No ghost User/U when accessing /app

---

## Test 5: Password Recovery Regression

### Purpose
Verify password recovery still works (critical regression test)

### Steps

1. **Request Password Reset**:
   - Logout completely
   - Go to `/forgot-password`
   - Enter valid email
   - Click "Gửi Email Khôi Phục"
   - Check email inbox

2. **Click Recovery Link**:
   - Open password reset email
   - Click recovery link
   - Should open `/reset-password` page

3. **Verify Recovery Page**:
   - Page state should be "ready"
   - Should show password reset form
   - Should NOT auto-navigate to `/app`
   - Should NOT show ghost User/U avatar

4. **Change Password**:
   - Enter new password
   - Enter confirm password
   - Click "Đặt Lại Mật Khẩu"
   - Wait for success

5. **Verify Success Screen**:
   - Should show success message
   - Should show "Đăng nhập" button
   - Should NOT auto-navigate to `/app`
   - Should NOT show:
     - Ghost User/U avatar
     - "Auth session missing" error
     - Dashboard elements

6. **Clear Console**:
   - Clear console log
   - Keep Network tab open

7. **Login with New Password**:
   - Click "Đăng nhập" on success screen
   - Go to `/login`
   - Enter email + NEW password
   - Click "Đăng nhập"

8. **Verify Console Output**:
   ```
   Expected:
   [RC2-perf] loadInitialData: 1
   
   NOT Expected:
   [RC2-perf] loadInitialData: 2
   ```

9. **Verify Login**:
   - Successfully redirects to `/app`
   - Dashboard loads correctly
   - Data appears normally
   - No errors

### ✅ Pass Criteria
- Recovery link works
- Reset page does NOT auto-navigate
- Success screen does NOT show ghost User/U
- No "Auth session missing" error
- Login with new password loads data once

---

## Test 6: USER_UPDATED (Profile Change)

### Purpose
Verify profile updates don't reload all app data

### Steps

1. **Prerequisites**:
   - Logged in at `/app`
   - Dashboard fully loaded

2. **Clear Console**:
   - Clear console log
   - Keep Network tab open

3. **Change Profile**:
   - Click profile menu → account
   - Change display name OR upload avatar
   - Click "Lưu Thay Đổi"
   - Wait for success toast

4. **Verify Console Output**:
   ```
   Expected:
   (No [RC2-perf] markers)
   
   NOT Expected:
   [RC2-perf] loadInitialData: 1
   [RC2-perf] refreshAppData: 1
   ```

5. **Verify Behavior**:
   - Profile updates in Navbar
   - Collections/topics/vocabulary NOT reloaded
   - Dashboard stays intact
   - No full app refresh
   - No loading spinner

6. **Verify Network Tab**:
   - Should see profile update requests
   - Should NOT see:
     - getCollections
     - getTopics
     - getVocabularies
     - getStudyStats
     - getDashboardMetrics

### ✅ Pass Criteria
- Profile updates successfully
- NO full data reload
- Collections/topics/vocabulary unchanged
- Console shows NO RC2-perf markers

---

## Test 7: Signup (If Applicable)

### Purpose
Verify signup flow loads data once

### Steps

**If signup creates session immediately**:

1. **Go to `/signup`**:
   - Enter new user details
   - Click "Đăng Ký"

2. **Verify Console Output**:
   ```
   Expected:
   [RC2-perf] loadInitialData: 1
   
   NOT Expected:
   [RC2-perf] loadInitialData: 2
   ```

3. **Verify Behavior**:
   - Creates account
   - Redirects to `/app`
   - Loads initial data once
   - Dashboard shows empty state (new user)

**If signup requires email confirmation**:

1. Keep existing signup flow
2. No changes needed
3. Verify no errors

### ✅ Pass Criteria
- Signup works as before
- If auto-login: data loads once
- If email confirm: existing flow preserved

---

## Test 8: Mutation Operations

### Purpose
Verify CRUD operations still call refreshAppData correctly

### Test 8a: Delete Section

1. **Prerequisites**:
   - At `/app` → VocabManager tab
   - At least one Section exists

2. **Clear Console**:
   - Clear console log

3. **Delete Section**:
   - Click delete icon on a Section
   - Confirm deletion

4. **Verify Console Output**:
   ```
   Expected:
   [RC2-perf] refreshAppData: 1
   
   NOT Expected:
   [RC2-perf] loadInitialData: 1
   ```

5. **Verify Behavior**:
   - Section removed from list
   - Data refreshed correctly
   - Dashboard updates

### Test 8b: Add Vocabulary

1. **Clear Console**

2. **Add Vocabulary**:
   - Click "+ Thêm Từ Vựng"
   - Fill form
   - Submit

3. **Verify Console Output**:
   ```
   Expected:
   [RC2-perf] refreshAppData: 1
   ```

4. **Verify Behavior**:
   - Vocabulary appears in list
   - Stats update

### ✅ Pass Criteria
- All CRUD operations work
- Each mutation calls refreshAppData: 1
- No loadInitialData calls

---

## Summary Checklist

After completing all tests, verify:

- [ ] Test 1: Login loads data once ✅
- [ ] Test 2: Refresh loads data once ✅
- [ ] Test 3: User switching works, loads once ✅
- [ ] Test 4: Logout works, no data calls ✅
- [ ] Test 5: Password recovery works, no regression ✅
- [ ] Test 6: Profile update doesn't reload app data ✅
- [ ] Test 7: Signup works (if applicable) ✅
- [ ] Test 8: Mutations call refreshAppData ✅
- [ ] No "Auth session missing" errors ✅
- [ ] No ghost User/U avatars ✅
- [ ] No duplicate data loads ✅
- [ ] Console shows correct instrumentation ✅

---

## Expected vs Actual Results Template

Use this template to record test results:

```
TEST 1: Fresh Login
Expected: loadInitialData: 1, ~20 requests
Actual: [RECORD YOUR RESULTS]
Status: [PASS/FAIL]
Notes: [ANY ISSUES]

TEST 2: Page Refresh
Expected: loadInitialData: 1, session persists
Actual: [RECORD YOUR RESULTS]
Status: [PASS/FAIL]
Notes: [ANY ISSUES]

[... continue for all tests ...]
```

---

## Rollback Instructions

**If any test fails**:

1. **Revert Changes**:
   ```bash
   git checkout app/app/page.tsx
   ```

2. **Verify Original Behavior**:
   - Re-run failed test
   - Confirm original behavior restored

3. **Report Issue**:
   - Document which test failed
   - Document expected vs actual
   - Include console output
   - Include network tab screenshot

---

## Next Steps After Testing

**If all tests pass**:
1. Remove temporary instrumentation (`console.count` lines)
2. Re-run build to verify
3. Update report with test results
4. Ready for commit

**If any test fails**:
1. Do NOT commit
2. Investigate root cause
3. Fix issue
4. Re-run all tests
5. Only commit when all tests pass

---

**Test Guide Status**: ✅ READY FOR MANUAL TESTING  
**Estimated Test Time**: 20-30 minutes for all scenarios
