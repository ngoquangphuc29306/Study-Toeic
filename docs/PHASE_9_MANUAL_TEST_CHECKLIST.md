# Phase 9 Manual Testing Checklist

**Branch:** `test/hardening`  
**Date:** 2026-08-01  
**Estimated Time:** 95 minutes

---

## Pre-Testing Setup

**Requirements:**
- [ ] Two test accounts (Alice and Bob)
- [ ] Fresh database or isolated test data
- [ ] Excel/LibreOffice for CSV verification
- [ ] Browser DevTools open for console monitoring

---

## 1. RLS Two-User Isolation Testing (30 min)

**Objective:** Verify complete data isolation between users

### Alice Account Tests
- [ ] Alice creates collection "Alice's Business" → verify visible in VocabManager
- [ ] Alice creates topic "Contracts" under "Alice's Business" → verify visible
- [ ] Alice adds 5 vocabularies to "Contracts" → verify visible in Flashcard mode
- [ ] Alice studies 2 cards (rate Good/Easy) → verify progress saved
- [ ] Alice exports CSV → verify file contains only Alice's 5 vocabularies
- [ ] Alice exports JSON → verify backup contains only Alice's collections/topics/vocabularies
- [ ] Alice reviews JSON content → verify no Bob data, no auth tokens, no passwords

### Bob Account Tests
- [ ] Bob logs in (new browser/incognito) → verify sees empty dashboard
- [ ] Bob's VocabManager → verify does NOT see "Alice's Business" collection
- [ ] Bob's VocabManager → verify does NOT see "Contracts" topic
- [ ] Bob attempts Flashcard mode → verify no Alice vocabularies appear
- [ ] Bob exports CSV → verify empty file (headers only) or error message
- [ ] Bob exports JSON → verify empty arrays for collections/topics/vocabularies

### Cross-User Import Tests
- [ ] Bob creates collection "Bob's Tech" and topic "Programming"
- [ ] Bob prepares Excel file with 3 vocabularies for "Programming" topic
- [ ] Bob successfully imports to his own topic → verify all 3 inserted
- [ ] Bob attempts to forge import: manually edit topic_id in network request to Alice's topic ID
- [ ] Expected: Import rejected by database FK constraint or RLS policy
- [ ] Verify Bob cannot bypass RLS through import manipulation

### Account Switch Tests
- [ ] Alice studies 3 cards → leave session open (no logout)
- [ ] Bob logs in same browser (logout → login as Bob) → verify Alice session cleared
- [ ] Bob's dashboard → verify shows 0 words studied, not Alice's progress
- [ ] Alice logs back in → verify her session was cleared, starts fresh

**Pass Criteria:** Complete data isolation, no cross-user visibility, FK constraints prevent unauthorized imports

---

## 2. Import/Export Functional Testing (20 min)

### CSV Export Tests
- [ ] Create 10 vocabularies with varied content:
  - Word with comma: "Invoice, receipt"
  - Word with quote: He said "hello"
  - Word with newline in note field
  - Vietnamese meaning with diacritics
  - Empty optional fields (synonyms, collocations)
- [ ] Export CSV → verify file downloads
- [ ] Open CSV in Excel → verify UTF-8 BOM works (Vietnamese displays correctly)
- [ ] Verify comma-word properly escaped (quoted)
- [ ] Verify quote-word properly escaped (doubled quotes)
- [ ] Verify newline in note properly escaped
- [ ] Verify headers in Vietnamese: "Từ vựng", "IPA-UK", etc.

### JSON Export Tests
- [ ] Export JSON backup → verify file downloads
- [ ] Open JSON in text editor → verify valid JSON format
- [ ] Verify structure: version=1, exportedAt timestamp, collections, topics, vocabularies, progress, reviewLogs
- [ ] Verify reviewLogsLimit=5000
- [ ] If account has <5000 reviews → verify reviewLogsTruncated=false
- [ ] If account has >5000 reviews → verify reviewLogsTruncated=true and only 5000 included
- [ ] Parse JSON → verify all fields intact, no corruption
- [ ] Verify no sensitive data: no auth tokens, no passwords, no service keys

### Excel/CSV Import Tests
- [ ] Prepare test Excel file with 10 rows (valid data)
- [ ] Import via ExcelImportModal → verify all 10 rows inserted
- [ ] Prepare test CSV file with 10 rows
- [ ] Import CSV → verify all 10 rows inserted (CSV supported via xlsx library)
- [ ] Import file with blank "word" column → verify row shows validation error
- [ ] Import file with blank "meaning" column → verify row shows validation error
- [ ] Import file with invalid topic_id (manually edit) → verify batch rejected with error
- [ ] Import duplicate word in same topic → verify BOTH inserted (no unique constraint)
- [ ] Import to topic owned by different user → verify rejected by FK constraint

### Edge Cases
- [ ] Export with 0 vocabularies → verify CSV headers-only or empty JSON arrays
- [ ] Import empty Excel file → verify appropriate error message
- [ ] Import Excel with only headers (no data rows) → verify no crash

**Pass Criteria:** All exports readable, all imports succeed with valid data, errors shown for invalid data

---

## 3. Session Recovery Testing (10 min)

**Objective:** Verify study session persists across page refreshes

### Basic Recovery
- [ ] Start Flashcard mode with 10 cards (filter: New)
- [ ] Rate 3 cards (Again, Good, Easy)
- [ ] Verify currentIndex=3 (4th card showing)
- [ ] Refresh browser page (F5)
- [ ] Verify session resumes at card 4 (not restarting from card 1)
- [ ] Verify Again card reappeared after gap=5 (check queue)

### Again Reinsertion
- [ ] Start session with 8 cards
- [ ] Rate card 1 as "Again" → verify reinserted after gap=5
- [ ] Continue to card 7 → verify card 1 reappears (gap calculation correct)
- [ ] Rate reappeared card as "Good" → verify removed from queue
- [ ] Refresh page → verify session state preserved

### Session Completion
- [ ] Start session with 5 cards
- [ ] Rate all 5 cards → verify completion screen with confetti
- [ ] Refresh page → verify NO session recovery (session cleared on completion)
- [ ] Start new session → verify fresh queue (not resuming old session)

### Session Clearing
- [ ] Start session → rate 2 cards → logout
- [ ] Login as same user → verify NO session recovery (cleared on logout)
- [ ] Start session → rate 2 cards → switch user (Alice → Bob)
- [ ] Login as Alice again → verify session was cleared during switch

**Pass Criteria:** Session persists across refresh, clears on completion/logout/switch

---

## 4. Auth State Handling (10 min)

**Objective:** Verify clean state transitions during auth events

### Logout Handling
- [ ] Alice studies 3 cards → has vocabularies visible
- [ ] Alice logs out → verify dashboard shows 0 words, empty state
- [ ] Verify no Alice data visible after logout
- [ ] Verify study session cleared from sessionStorage

### User Switch (Same Browser)
- [ ] Alice studies, has 10 vocabularies
- [ ] Logout → Login as Bob → verify sees Bob's data (0 or Bob's vocabularies)
- [ ] Verify Alice session cleared
- [ ] Verify Alice vocabularies NOT visible
- [ ] Verify dashboard metrics reset to Bob's stats

### Auth Expiration
- [ ] Start study session (valid auth)
- [ ] Manually expire Supabase token (DevTools: clear cookies or wait for expiration)
- [ ] Rate next card → verify error message shown
- [ ] Verify error message in Vietnamese: "Phiên đăng nhập đã hết hạn"
- [ ] Verify no crash, user prompted to re-login

### Token Refresh
- [ ] Start long study session (30+ min if possible)
- [ ] Continue rating cards → verify Supabase auto-refresh works
- [ ] Verify no interruption in session flow

**Pass Criteria:** Clean state clearing, no data leaks between users, graceful auth error handling

---

## 5. UI State Verification (15 min)

**Objective:** Verify loading, empty, and error states display correctly

### Loading States
- [ ] Dashboard load → verify loading skeleton appears briefly
- [ ] Flashcard rating submission → verify buttons disabled during submit
- [ ] Verify button shows "Đang lưu..." or similar loading text
- [ ] Export CSV → verify button shows "Đang xuất..." text
- [ ] Export CSV → verify button disabled (opacity-50 class applied)
- [ ] Import Excel → verify parsing shows loading indicator
- [ ] Import Excel → verify submit shows "Đang Import..." text

### Empty States
- [ ] New account dashboard → verify shows empty state message
- [ ] VocabManager with 0 vocabularies → verify shows "Chưa có từ vựng" or similar
- [ ] Flashcard mode with 0 new cards → verify appropriate message
- [ ] Export CSV with 0 vocabularies → verify error: "Không có từ vựng nào để xuất"

### Error States
- [ ] Import invalid Excel → verify Vietnamese error message displayed
- [ ] Import with network error (DevTools: offline mode) → verify error shown
- [ ] Rating submission failure (simulate by network throttling) → verify error banner
- [ ] Export CSV failure → verify alert with Vietnamese message (current implementation)
- [ ] Dashboard metrics load failure → verify error state (not infinite loading)

### Retry Paths
- [ ] Import error shown → fix file → retry import → verify success
- [ ] Rating error shown → retry button (if available) or re-rate → verify works
- [ ] Dashboard error → refresh page → verify reload attempt

**Pass Criteria:** All states display correctly, no infinite loading, clear error messages

---

## 6. Performance Testing (10 min)

**Objective:** Measure actual performance vs estimates

### Dashboard Load
- [ ] Clear cache → reload dashboard → measure time in DevTools Network tab
- [ ] Target: <2s for initial load
- [ ] Verify 8 queries total (4 app load + 4 dashboard metrics)
- [ ] Verify queries run in parallel (no waterfall)

### Export Performance
- [ ] Export 100 vocabularies to CSV → measure time
- [ ] Target: <2s (estimated)
- [ ] Verify browser doesn't freeze during export
- [ ] Export 100 vocabularies to JSON → measure time
- [ ] Target: <3s (estimated)

### Import Performance
- [ ] Import 100-row Excel → measure time from file select to completion
- [ ] Target: <5s (parsing + validation + insert)
- [ ] Verify UI responsive during parse
- [ ] If available: Import 1000-row Excel → measure time
- [ ] Target: <10s (estimated 3-6s, but with buffer)
- [ ] Monitor browser memory usage (DevTools Memory profiler)

### Query Count Verification
- [ ] Open DevTools Network tab → filter "supabase"
- [ ] Load dashboard → count actual Supabase requests
- [ ] Expected: 8 queries (4 app load + 4 dashboard metrics)
- [ ] Verify no N+1 query patterns
- [ ] Verify streak query bounded (365 days max)

**Pass Criteria:** Performance meets estimates, no browser freeze, reasonable memory usage

---

## 7. Edge Cases and Stress Tests (10 min)

### Rapid Interactions
- [ ] Click "Xuất CSV" button 5 times rapidly → verify only 1 export triggered
- [ ] Click rating buttons rapidly → verify only 1 rating submitted (isSubmitting guard)
- [ ] Import → click submit rapidly → verify only 1 batch insert

### Concurrent Operations
- [ ] Start export CSV → immediately start export JSON → verify both complete
- [ ] Start study session → immediately logout → verify clean state
- [ ] Start import → close modal mid-parse → verify no crash

### Large Data
- [ ] Account with 500+ vocabularies → verify dashboard loads
- [ ] Account with 500+ vocabularies → verify export CSV completes
- [ ] Account with 5001+ review logs → verify JSON export truncates correctly

### Browser Compatibility
- [ ] Test in Chrome → verify all features work
- [ ] Test in Firefox → verify all features work
- [ ] Test in Edge → verify all features work
- [ ] Test mobile viewport → verify responsive design (not full mobile testing)

**Pass Criteria:** No crashes, guards prevent duplicate operations, large data handled gracefully

---

## 8. Security Verification (10 min)

### RLS Bypass Attempts
- [ ] DevTools Network tab → copy Alice's vocabulary query
- [ ] Modify user_id parameter (if exposed) → verify rejected by RLS
- [ ] Copy Alice's export request → forge as Bob → verify returns only Bob's data
- [ ] Attempt SQL injection in search field (if any) → verify sanitized

### XSS Testing
- [ ] Create vocabulary with word: `<script>alert('XSS')</script>`
- [ ] View in Flashcard mode → verify script NOT executed (escaped)
- [ ] Export to CSV → open in Excel → verify no script execution
- [ ] Import vocabulary with HTML tags → verify safely handled

### Console Security
- [ ] Open DevTools Console → review all logged errors
- [ ] Verify no auth tokens logged
- [ ] Verify no passwords logged
- [ ] Verify no sensitive user data in console

### Export Security
- [ ] Export JSON → search for "token", "password", "secret", "key"
- [ ] Verify NONE found in export file
- [ ] Verify only user-created content included

**Pass Criteria:** RLS cannot be bypassed, no XSS vulnerabilities, no sensitive data exposed

---

## 9. Regression Testing (5 min)

**Objective:** Verify Phase 1-8 features still work after Phase 9 changes

- [ ] Create collection → verify success
- [ ] Create topic → verify success
- [ ] Add vocabulary manually → verify success
- [ ] Study with Again rating → verify gap=5 reinsertion works (Phase 6 fix)
- [ ] Study with Good rating → verify progress saved (Phase 5 fix)
- [ ] Complete study session → verify confetti animation
- [ ] Delete vocabulary → verify removed from all views
- [ ] Delete topic with vocabularies → verify blocked with error (Phase 2E safety)
- [ ] Delete collection with topics → verify blocked with error (Phase 2E safety)

**Pass Criteria:** All existing features still functional, no regressions introduced

---

## 10. Final Smoke Test (5 min)

**End-to-End Happy Path:**

1. [ ] New user signs up
2. [ ] Creates collection "TOEIC Business"
3. [ ] Creates topic "Part 5 Grammar"
4. [ ] Imports 20-row Excel file with vocabularies
5. [ ] Verifies 20 vocabularies appear in VocabManager
6. [ ] Starts Flashcard study session
7. [ ] Rates 10 cards (mix of Again, Good, Easy)
8. [ ] Verifies Again cards reappear after gap
9. [ ] Completes session → sees confetti
10. [ ] Exports CSV → opens in Excel → verifies data correct
11. [ ] Exports JSON → verifies backup complete
12. [ ] Logs out → logs back in → verifies data persisted

**Pass Criteria:** Complete user journey successful with no errors

---

## Test Results Summary

**Date Completed:** _____________  
**Tester:** _____________  
**Total Tests:** 150+  
**Passed:** _____  
**Failed:** _____  
**Blocked:** _____  

### Critical Issues Found

_(List any blocking issues that prevent production deployment)_

### High-Priority Issues Found

_(List issues that should be fixed before deployment but don't block)_

### Low-Priority Issues Found

_(List nice-to-have fixes or polish items)_

### Notes

_(Any additional observations, performance metrics, or recommendations)_

---

## Sign-Off

**QA Approval:** _________________ Date: _______  
**Product Approval:** _________________ Date: _______  
**Ready for Production:** YES / NO

---
