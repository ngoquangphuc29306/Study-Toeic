# VocabTOEIC — Product Decisions

**Document Version**: 2.0  
**Created**: 2026-07-30  
**Updated**: 2026-07-30  
**Status**: Product Owner Approved  
**Authority**: Highest precedence — all other documents must align with approved decisions here

---

## 1. Product Model

### 1.1. Core Identity
**VocabTOEIC** là personal vocabulary learning application, tập trung vào individual learning experience.

**User Model**:
- Mỗi user sở hữu data của chính họ
- Data KHÔNG được share với users khác
- KHÔNG có social features, leaderboard, hoặc cross-user interaction
- User tự quản lý vocabularies, collections, topics, progress

**Data Ownership**:
- User data belongs to user
- User-created content: collections, topics, vocabularies, progress
- User có quyền export, delete toàn bộ data

---

## 2. Approved Decisions

### 2.1. SRS Algorithm — MVP Approved

**Status**: ✅ APPROVED for MVP

The MVP SRS algorithm **preserves current behaviour** exactly as implemented in `services/vocabService.ts` lines 557-656.

**Rating System**: Four buttons
- **Again** (Quên): 1 minute
- **Hard** (Khó): initial 6 hours if first review, then ×2 current interval
- **Good** (Được): initial 24 hours if first review, then ×3 current interval  
- **Easy** (Dễ): initial 72 hours if first review, then ×4 current interval

**Manual Mastery**:
- User can manually mark vocabulary as "Đã Thuộc" (mastered)
- Mastered words exit the review queue
- `status = 'mastered'`, `next_review_at = null`

**Learning States**: Three states approved
- `new` — never studied
- `learning` — in review cycle
- `mastered` — manually marked as learned, no further reviews

**Behaviour**:
- First review: uses initial intervals (6h, 24h, 72h)
- Subsequent reviews: multiplies current `interval_hours` (×2, ×3, ×4)
- Again: resets to 1 minute, increments `again_count`
- No automatic mastery promotion
- No interval cap
- No ease factors
- No lapse handling beyond again_count tracking

**Implementation Requirements**:
- Pure domain functions with explicit timestamp parameter
- No `Date.now()` inside domain logic
- Idempotent rating submission
- Atomic progress update + review log creation
- Duplicate submit protection

---

### 2.2. Daily Goal — Soft Target

**Status**: ✅ APPROVED

**Behaviour**:
- User sets optional daily goal (e.g., "20 cards per day")
- Dashboard displays progress toward goal
- Reaching goal does NOT block further study
- User can continue studying beyond daily goal
- Soft encouragement only, no hard limit

**Not Approved**:
- ❌ Hard cap that blocks study after limit reached
- ❌ Forced breaks
- ❌ Penalties for exceeding goal

---

### 2.3. Mastered Words Review

**Status**: ✅ APPROVED for MVP

**Behaviour**:
- Mastered words remain excluded from normal due queue
- NO automatic periodic review in MVP
- Mastered words visible in Dashboard "Đã Thuộc" section
- User can view mastered words in Vocab Manager

**Deferred**:
- 🔮 Manual "unmaster" button (allow user to return word to learning)
- 🔮 Optional "refresh mastery" review mode
- 🔮 Automatic mastery re-review (requires explicit approval)

---

### 2.4. Supabase as Source of Truth

**Status**: ✅ APPROVED

After a domain is migrated to Supabase:
- **Supabase becomes the single source of truth**
- localStorage must NOT be used as a silent long-term persistence fallback
- localStorage is permitted ONLY for:
  - One-time data migration (from prototype to production)
  - Temporary drafts (e.g., unsaved form input)
  - Bounded study session recovery (current session only)
  - Domains not yet migrated in current phase

**Not Approved**:
- ❌ Offline-first sync architecture
- ❌ Conflict resolution between localStorage and Supabase
- ❌ Long-term localStorage as "backup" or "fallback" for migrated domains

**Rationale**: Simplicity and single source of truth prevent data inconsistency.

---

### 2.5. Routing — First Vertical Slice

**Status**: ✅ APPROVED for first vertical slice

**Current Application**:
- SPA at `/` with tab-based navigation
- Tabs: Dashboard, Flashcards, Quiz, Vocab Manager
- React state switching, no URL changes

**First Vertical Slice Routes**:
- Add `/login` page (new)
- Add `/signup` page (new)
- Keep existing app at `/` (no changes to current SPA)
- After login: redirect to `/` (current dashboard tab)

**Deferred**:
- 🔮 Move app to `/dashboard`
- 🔮 Separate routes for `/flashcards`, `/quiz`, `/vocabularies`
- 🔮 Deep linking with URL parameters
- 🔮 Public landing page
- 🔮 Admin routes
- 🔮 Full App Router migration

**Rationale**: Minimize risk by adding auth routes without restructuring existing app.

---

### 2.6. First Vertical Slice Definition

**Status**: ✅ APPROVED

The first vertical slice validates the full stack from UI to database with RLS:

**User Flow**:
1. Sign up at `/signup`
2. Sign in at `/login`
3. Navigate to Dashboard (current `/` app)
4. Create Collection
5. Create Topic under Collection
6. Add Vocabulary to Topic
7. Refresh browser
8. Data persists (fetched from Supabase)
9. Log in as different user
10. Cannot access first user's data (RLS enforced)

**Success Criteria**:
- All CRUD operations persist to Supabase
- RLS blocks cross-user access
- Refresh preserves data
- No localStorage for migrated domains

---

### 2.7. Review Logs Security

**Status**: ✅ APPROVED

**Requirement**: `review_logs` table must NOT accept trusted audit data directly from browser.

**Approved Pattern**:
- Browser submits: `vocabulary_id`, `rating`, `idempotency_key`
- Database function/RPC calculates: `previous_interval`, `new_interval`, `next_review_at`
- Single atomic transaction: update `user_vocab_progress` + insert `review_logs`
- Server owns the scheduling logic, not the client

**Not Approved**:
- ❌ Browser provides `previous_interval` and `new_interval` as trusted input
- ❌ Separate INSERT by browser into `review_logs`
- ❌ Non-atomic updates (progress then log)

**Rationale**: Prevent client manipulation of review history and ensure audit integrity.

---

### 2.8. Child Ownership Consistency

**Status**: ✅ APPROVED

**Requirement**: Database must enforce same-owner relationships between parent and child entities.

**Approved Pattern**:
- Composite foreign keys: `FOREIGN KEY (parent_id, user_id) REFERENCES parent(id, user_id)`
- Ensures child.user_id matches parent.user_id at database level
- Simple foreign keys alone are insufficient

**Example**:
```sql
-- PROPOSED: Not migration-ready
CREATE TABLE topics (
  id UUID PRIMARY KEY,
  collection_id UUID NOT NULL,
  user_id UUID NOT NULL,
  FOREIGN KEY (collection_id, user_id) 
    REFERENCES collections(id, user_id)
);
```

**Not Approved**:
- ❌ Simple `FOREIGN KEY (collection_id) REFERENCES collections(id)` without user_id
- ❌ Claiming RLS policies alone enforce ownership (policies can be bypassed by service-role key)

---

### 2.9. SQL Examples Status

**Status**: ✅ APPROVED clarification

All SQL examples in documentation (SCHEMA definitions, RLS policies, indexes, constraints) are:
- **Proposed architectural drafts**
- **Not migration-ready**
- **Not tested in actual Supabase environment**
- **Require validation before deployment**

**Label Required**: Every SQL block must be labeled `-- PROPOSED: Not migration-ready`

**Rationale**: Documentation describes intended architecture, not executable production code.

---

## 3. Current Behaviour (Verified)

These behaviours are verified from current codebase and must be preserved unless explicitly changed by approved decision.

### 3.1. SRS Scheduling
From `services/vocabService.ts`:
- Again: 1 minute (`1 / 60 hours`)
- Hard: `currentInterval > 0 ? currentInterval * 2 : 6` hours
- Good: `currentInterval > 0 ? currentInterval * 3 : 24` hours
- Easy: `currentInterval > 0 ? currentInterval * 4 : 72` hours
- Mastered: `next_review_at = null`

### 3.2. Progress Fields
From `lib/types.ts` UserVocabProgress:
```typescript
vocabulary_id: string
status: 'new' | 'learning' | 'mastered'
review_count: number
last_reviewed_at: string
next_review_at: string | null
interval_hours: number
again_count: number
mastery_level?: number
```

### 3.3. Study Session Behaviour
- Flashcard session fetches vocabularies filtered by topic/status
- Cards shown in order (or shuffled if implemented)
- Each rating updates progress immediately
- Session state kept in React component state (not persisted)
- Refresh loses session progress (no recovery in current code)

### 3.4. Streak Calculation
From `services/vocabService.ts` lines 636-640:
- Records today's date in localStorage `STUDY_DATES_KEY`
- Streak calculated from consecutive dates array
- Persists to localStorage only (not Supabase)

### 3.5. UI Interactions (Verified)
- Tab navigation via React state (`setActiveTab`)
- Modals controlled by boolean state
- Flashcard flip animation exists (CSS transition)
- Confetti on completion exists (imported in FlashcardMode and QuizMode)
- Keyboard shortcuts exist in FlashcardMode (Space, ArrowLeft, ArrowRight, Enter, Tab, Digit1-4)

---

## 4. Deferred Decisions

These features are NOT approved for MVP and require explicit product owner approval before implementation.

### 4.1. Enhanced SRS Algorithms

**Status**: 🔮 DEFERRED — Research phase required

**Options Under Consideration**:
1. **Modified SM-2**:
   - Add ease_factor (1.3 to 2.5)
   - Lapse handling with relearning steps
   - Interval cap (e.g., 365 days max)
   - Auto-mastery promotion criteria

2. **FSRS (Free Spaced Repetition Scheduler)**:
   - Machine learning-based scheduling
   - Adaptive difficulty estimation
   - Requires training data

3. **Keep Current Algorithm**:
   - Proven simple implementation
   - User familiar with behaviour
   - No migration risk

**Decision Required**:
- Product owner must explicitly approve algorithm choice
- Requires user testing and A/B comparison
- Migration plan for existing progress data
- Rollback strategy if algorithm performs worse

**Questions for Product Owner**:
1. Should MVP launch with current algorithm, then research enhancement?
2. Is algorithm enhancement high priority or low priority?
3. Budget for user testing and A/B testing?

---

### 4.2. Session Queue Behaviour

**Status**: 🔮 DEFERRED

**Open Question**: Can a card appear multiple times in one session?

**Current Behaviour**: Not explicitly defined in code. Cards fetched once per session start, no re-queue logic visible.

**Options**:
1. **One appearance per session** (strict):
   - Card shown once, then excluded from current session
   - New session required to see card again
   - Prevents immediate re-review of "Again" cards

2. **Allow re-queue** (flexible):
   - "Again" cards added back to end of current session queue
   - User can review difficult cards multiple times
   - Risk: session never ends if user keeps hitting "Again"

3. **Hybrid**:
   - "Again" cards re-queued with max 2 appearances per session
   - After 2nd "Again", card exits session

**Decision Required**: Product owner must specify queue behaviour if different from current implementation.

---

### 4.3. Routing Migration

**Status**: 🔮 DEFERRED until Phase 6+

**Options**:
1. Move app to `/dashboard`, separate routes for features
2. Keep SPA forever, never migrate to full routing
3. Partial migration (some features get routes, others stay tabs)

**Dependencies**:
- User feedback after first vertical slice
- Performance impact of client-side routing
- SEO requirements (if public content added)

---

### 4.4. Public Landing Page

**Status**: 🔮 DEFERRED

**Options**:
1. Public landing at `/`, app at `/dashboard` (requires routing migration)
2. Direct to login (no public page, keep current `/`)
3. Separate marketing domain

**Questions**:
- Is public landing page needed for user acquisition?
- Budget for marketing site design?
- Timeline priority?

---

### 4.5. Offline Mode

**Status**: 🔮 DEFERRED

**Options**:
1. No offline mode (online-only app)
2. Service Worker caching (static assets only)
3. Full offline-first with sync (complex, high cost)

**Rationale for Deferral**:
- Offline-first sync adds significant complexity
- Conflict resolution between offline changes and server state
- localStorage already removed as long-term fallback per approved decision
- Most users have stable internet for web app usage

---

### 4.6. Manual Unmaster

**Status**: 🔮 DEFERRED

**Feature**: Button to move mastered word back to "learning" state

**Use Case**: User discovers they don't actually know a mastered word

**Decision Required**: Priority and UX design

---

### 4.7. Auto-Mastery Promotion

**Status**: 🔮 DEFERRED — Requires enhanced SRS algorithm approval

**Feature**: Automatically promote word to "mastered" based on criteria

**Example Criteria**:
- ease_factor > 2.3 AND interval > 90 days
- No "Again" ratings in last 6 months
- 10+ consecutive "Easy" or "Good" ratings

**Dependencies**: Enhanced SRS algorithm (SM-2 or FSRS)

---

## 5. Performance Targets

**Status**: Aspirational targets, not guaranteed contracts

| Metric | Target | Notes |
|--------|--------|-------|
| Initial page load | < 2s | First contentful paint |
| Dashboard stats load | < 500ms | After authentication |
| Flashcard flip animation | < 100ms | CSS transition |
| Rating submission | < 200ms | Database round-trip |
| Import 1000 rows | < 10s | Excel processing + DB insert |
| Bundle size (gzipped) | < 500KB | Excludes node_modules |

**Measurement**: Lighthouse audit, Chrome DevTools Performance tab

**Note**: Targets are goals, not requirements for launch. Performance optimization is iterative.

---

## 6. Out of Scope

These features are explicitly OUT of scope for VocabTOEIC and should NOT be added without explicit product owner approval and significant product direction change.

### 6.1. Social Features
- ❌ Share vocabulary lists with friends
- ❌ Social feed or activity stream
- ❌ Follow other users
- ❌ Comments or discussions on vocabularies
- ❌ Public user profiles

**Rationale**: Personal learning app, not social platform.

### 6.2. Leaderboard and Competition
- ❌ Global leaderboard
- ❌ Friend leaderboards
- ❌ Badges and achievements (heavy gamification)
- ❌ Competitive study modes

**Rationale**: Focus on personal progress, not comparison with others. Light gamification (streak, goals) is acceptable.

### 6.3. AI-Generated Content
- ❌ AI-generated example sentences
- ❌ AI-generated synonyms/antonyms
- ❌ AI conversation practice
- ❌ AI personalized recommendations

**Rationale**: User-created content model. AI features require separate product decision and API costs.

### 6.4. Marketplace
- ❌ Buy/sell vocabulary packs
- ❌ Premium content subscriptions
- ❌ User-generated content marketplace

**Rationale**: Not a monetization-focused app in MVP.

### 6.5. Multi-Language Support
- ❌ UI translated to multiple languages
- ❌ Learning vocabularies from languages other than English

**Rationale**: MVP targets Vietnamese users learning English vocabulary for TOEIC. Multi-language adds complexity.

**Current Language Model**:
- UI: Vietnamese (tiếng Việt)
- Target language: English (TOEIC vocabulary)
- Example sentences: English with Vietnamese translations

---

## 7. Open Questions for Product Owner

### 7.1. Session Queue Behaviour (Priority: HIGH)
**Question**: Can a card that receives "Again" rating reappear later in the same study session?

**Options**:
- A: One appearance per session (strict)
- B: Re-queue "Again" cards (flexible)
- C: Hybrid (max 2 appearances)

**Impact**: Affects user experience in flashcard mode, session completion behaviour

---

### 7.2. SRS Algorithm Enhancement Timeline (Priority: MEDIUM)
**Question**: When should enhanced SRS algorithm (SM-2/FSRS) be researched and potentially implemented?

**Options**:
- A: After MVP launch, based on user feedback (recommended)
- B: Before MVP launch (delays release)
- C: Low priority, keep current algorithm long-term

**Impact**: Development timeline, user learning effectiveness

---

### 7.3. Routing Migration Timeline (Priority: LOW)
**Question**: When should full routing migration happen?

**Options**:
- A: Phase 6 (after core features stable)
- B: Phase 8+ (after testing)
- C: Never (keep SPA)

**Impact**: Deep linking, browser navigation, SEO

---

### 7.4. Manual Unmaster Feature (Priority: LOW)
**Question**: Should users be able to move mastered words back to learning state?

**Options**:
- A: Yes, add "Unmaster" button in Vocab Manager
- B: No, mastered is permanent (user can delete and re-add if needed)
- C: Yes, but with confirmation warning

**Impact**: User control vs data integrity

---

## 8. Document Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-30 | Phase 0 | Initial product decisions |
| 2.0 | 2026-07-30 | Phase 0 Correction | Separated approved/deferred decisions, clarified MVP SRS algorithm, added review logs security, removed unapproved features from contracts |

**Next Review**: After product owner answers open questions

**Approval Status**: ✅ Approved by product owner (pending open question responses)

- User authentication (Supabase Auth)
- Dashboard với stats (due, learning, mastered, streak)
- Collection/Topic management (CRUD)
- Vocabulary CRUD (manual add, edit, delete)
- Import (Excel, CSV)
- **Flashcard mode** (SRS-based review)
- **Quiz mode** (multiple choice, fill-in-blank)
- **Typing mode** (nếu đã triển khai hoặc dự kiến)
- Spaced Repetition System (SRS) scheduling
- Daily goals (số từ học mỗi ngày)
- Streak tracking (số ngày liên tục học)
- Review history (log mỗi lần rating)
- User settings (preferences)

### 4.2. OUT OF SCOPE (Not Planned)
❌ Không bao gồm:
- Social features (friends, sharing)
- Leaderboard
- Heavy gamification (badges, achievements, levels)
- Multiplayer/competitive modes
- Public profiles
- Comments/forums
- Marketplace

**Rationale**: VocabTOEIC là công cụ học tập cá nhân, tập trung vào hiệu quả SRS, không phải social network.

### 4.3. Open for Future Discussion
🔮 Có thể cân nhắc sau:
- Light gamification (simple badges cho milestones)
- Export progress (backup JSON/CSV)
- Print flashcards (PDF export)
- Public vocabulary catalogue (read-only)
- Offline mode (PWA với service worker)

**Approval Required**: Mọi thay đổi scope phải được product owner phê duyệt trước khi implement.

---

## 5. Study Session Behavior

### 5.1. Session Persistence
**Target Behavior** (phase sau):
- Study session phải **recoverable sau refresh**
- Session state bao gồm:
  - Queue order (danh sách từ đang học)
  - Current index (từ đang ở)
  - Ratings đã submit (nếu chưa commit DB)
  - Session start time
  - Answered count

**Current Behavior** (baseline):
- Session lost on refresh → user quay lại dashboard
- Không có session recovery

**Migration Note**: Phase 5 sẽ implement session persistence (session table hoặc localStorage backup).

### 5.2. Review Queue Logic
**Business Rules**:
1. Due words (next_review_at <= now) được ưu tiên cao nhất
2. Nếu không đủ due words, thêm new words
3. Shuffle queue để tránh pattern
4. Mỗi từ chỉ xuất hiện 1 lần trong session (no immediate repeats)

**Daily Limit**:
- User có thể set daily goal (ví dụ: 20 từ/ngày)
- Dashboard hiển thị progress: "15/20 từ hôm nay"

---

## 6. Review Log Requirements

### 6.1. Audit Trail
**Critical**: Mỗi lần user rate một từ, system phải tạo **review log entry**.

**Required Fields** (future schema):
```typescript
{
  id: uuid
  user_id: uuid (auth.uid())
  vocabulary_id: string
  rating: 'again' | 'hard' | 'good' | 'easy'
  session_id?: uuid (optional)
  reviewed_at: timestamptz
  time_spent_ms?: number
  previous_interval_hours?: number
  new_interval_hours: number
  previous_status: LearningStatus
  new_status: LearningStatus
}
```

**Purpose**:
- Analytics (user performance over time)
- Undo/redo capability
- Algorithm tuning (A/B test intervals)
- Compliance (data export requests)

**Current State**: Chưa implement review_logs table. Phase 4 sẽ thêm.

---

## 7. Data Consistency Rules

### 7.1. Atomicity
**Progress update + Review log MUST be atomic**.

**Implementation**:
- Single transaction hoặc RPC function
- Nếu review log insert fails → rollback progress update
- Client retry logic với idempotency key

### 7.2. Ownership Cascade
**Rule**: Child record PHẢI thuộc cùng owner với parent.

Example:
- Topic.user_id = Collection.user_id
- Vocabulary.user_id = Topic.user_id
- UserVocabProgress.user_id = Vocabulary.user_id (hoặc auth.uid())

**Enforcement**:
- Database foreign key constraints
- RLS policies
- Application validation

### 7.3. Client Trust
**Zero Trust Principle**: Server KHÔNG tin user_id từ client.

**Enforcement**:
- RLS policies dùng `auth.uid()` từ JWT
- Supabase client (anon key) không cho phép ghi user_id tùy ý
- Service-role key KHÔNG được dùng trong browser

---

## 8. Open Decisions

### 8.1. Requires Product Owner Input
🔴 **Pending Decisions**:

1. **SRS Algorithm**: Giữ current simple algorithm hay migrate sang SM-2/FSRS?
   - Current: Again=5min, Hard=×2, Good=×3, Easy=×4
   - Option: SM-2 với ease factor
   - Option: FSRS (machine learning based)

2. **Daily Limit Enforcement**: Hard limit hay soft reminder?
   - Hard: Disable "Continue" button khi đạt limit
   - Soft: Show warning nhưng vẫn cho học tiếp

3. **Mastered Words Review**: Có schedule lại mastered words không?
   - Option A: Mastered = never review again
   - Option B: Mastered review every 6 months
   - Option C: User configurable

4. **Public Catalogue**: Khi nào triển khai shared vocabulary?
   - Phase 10+?
   - Separate product?

5. **Timezone Handling**: User timezone hay server timezone?
   - Current: Browser local time
   - Target: User profile timezone setting

---

## 9. Non-Negotiable Contracts

### 9.1. Security
- ✅ User data MUST be isolated (RLS enforced)
- ✅ No user can access another user's private data
- ✅ Service-role key only for server-side operations
- ✅ Input sanitization for all user content

### 9.2. Data Integrity
- ✅ Vocabulary content và progress tách domain
- ✅ Progress updates atomic với review logs
- ✅ No orphan records (foreign keys enforced)
- ✅ Soft delete cho vocabularies (có thể recover)

### 9.3. User Experience
- ✅ UI/UX hiện tại là visual source of truth
- ✅ No breaking changes without approval
- ✅ Accessibility compliance (WCAG 2.1 AA minimum)
- ✅ Mobile-responsive (touch-friendly)

### 9.4. Performance
- ✅ Dashboard load < 2 seconds
- ✅ Flashcard flip < 200ms
- ✅ Rating submit feedback < 500ms
- ✅ No blocking localStorage operations

---

## Document Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-30 | Phase 0 | Initial product decisions contract |

**Approval**: This document requires product owner sign-off before being used as source of truth for development phases.
