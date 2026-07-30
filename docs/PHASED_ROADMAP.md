# VocabTOEIC — Phased Roadmap

**Document Version**: 2.0  
**Created**: 2026-07-30  
**Updated**: 2026-07-30  
**Status**: Official Development Roadmap  
**Authority**: Defines phase sequence and acceptance criteria

---

## Overview

This roadmap transforms VocabTOEIC từ Google AI Studio prototype sang production-ready application theo incremental phases.

**Principles**:
- Mỗi phase có deliverable rõ ràng
- Mỗi phase kết thúc với working, tested code
- Có thể rollback nếu phase fail
- UI preservation contract được enforce ở tất cả phases
- Data ownership contract được enforce từ Phase 2+

---

## Phase 0 — Contracts

**Status**: ✅ COMPLETED

**Goal**: Establish product and architecture contracts làm foundation cho tất cả phases sau.

**Scope**:
- Tạo documentation trong `docs/`
- KHÔNG sửa application code
- KHÔNG thay đổi UI
- KHÔNG cài dependencies mới
- KHÔNG tạo migrations
- KHÔNG commit

**Deliverables**:
- ✅ `docs/PRODUCT_DECISIONS.md` — Approved/Current/Deferred decisions
- ✅ `docs/UI_PRESERVATION_CONTRACT.md` — Visual source of truth (verified features only)
- ✅ `docs/DATA_OWNERSHIP_CONTRACT.md` — Security model, RLS, composite FKs
- ✅ `docs/ROUTE_CONTRACT.md` — Current SPA, Phase 2 auth routes
- ✅ `docs/SRS_TARGET_SPEC.md` — Current algorithm as MVP target, atomic RPC
- ✅ `docs/TARGET_ARCHITECTURE.md` — Layered architecture, algorithm-neutral examples
- ✅ `docs/PHASED_ROADMAP.md` — This document
- ✅ `docs/README.md` — Document index and precedence

**Acceptance Criteria**:
- All 8 documents created
- Git diff shows ONLY new/modified files in `docs/`
- No application code changed
- Product owner reviews and approves contracts

**Rollback**: N/A (no code changes)

**Commit Strategy**: Single commit "docs: Phase 0 — Product and Architecture Contracts"

---

## Phase 1 — Cloud Development Supabase Foundation

**Status**: 🔄 NEXT

**Goal**: Setup cloud development Supabase project with versioned migrations and PROPOSED schema (not production deployment yet).

**Environment Strategy**:
- **Development**: `vocabtoeic-dev` — cloud project for destructive testing and iteration
- **Production**: `vocabtoeic-prod` — created in Phase 10, never accessed before then
- **Source of Truth**: Migration files in Git (not Dashboard SQL Editor)

**Prerequisites**:
- Phase 0 contracts approved
- Supabase account created
- Development project `vocabtoeic-dev` created on Supabase Cloud

**Scope**:
✅ **Allowed**:
- Run `npx supabase init` to create `supabase/` directory
- Run `npx supabase login` to authenticate
- Run `npx supabase link --project-ref <dev-project-ref>` to link to `vocabtoeic-dev`
- Create versioned migration files with PROPOSED schema
- Write RLS policies
- Create seed data for testing
- Run `npx supabase db push` to apply migrations to cloud dev
- Verify schema and RLS on cloud development project
- Add Supabase client initialization (not yet used by app)

❌ **Not Allowed**:
- Use Dashboard SQL Editor without corresponding migration file
- Deploy to production Supabase project
- Link to production project reference
- Migrate existing features to use Supabase
- Remove localStorage
- Change UI
- Add authentication flows

**File Structure**:
```
supabase/
  ├── config.toml
  ├── .gitignore
  ├── seed.sql                    # Optional: dev seed data (not migrated to production)
  └── migrations/
        ├── 20260730_001_init_schema.sql
        └── 20260730_002_rls_policies.sql

lib/
  └── supabase.ts  # Client initialization (not yet used)
```

**Tasks**:
1. Create `vocabtoeic-dev` project on Supabase Cloud dashboard
2. Initialize: `npx supabase init`
3. Login: `npx supabase login`
4. Link to dev: `npx supabase link --project-ref <dev-project-ref>`
5. Create migration 001: Init schema (profiles if needed, collections, topics, vocabularies)
6. Create migration 002: RLS policies (enforce user_id ownership)
7. (Optional) Create `supabase/seed.sql`: Sample data for development testing only
8. Review migrations (SQL syntax, composite FKs, RLS policies)
9. Push to cloud dev: `npx supabase db push`
10. Verify schema in Supabase Dashboard (Tables, RLS enabled)
11. Initialize Supabase client in `lib/supabase.ts` (not yet used by app)

**Note on Seed Data**:
- Seed data is NOT part of production migrations
- Use optional `supabase/seed.sql` for development testing only
- Production databases start empty (users create their own data)
- Seed file is not versioned as a migration

**Phase 1 Schema Scope** (Limited):
- `profiles` table (if required for user metadata)
- `collections` table
- `topics` table
- `vocabularies` table
- Indexes on foreign keys and user_id columns
- Composite foreign keys (enforce same-owner relationships)
- RLS policies (SELECT/INSERT/UPDATE/DELETE per table)
- Profile creation trigger (if profiles table exists)

**Deferred to Implementation Phases**:
- ❌ `user_vocab_progress` (Phase 5)
- ❌ `review_logs` (Phase 5)
- ❌ `submit_vocabulary_rating` RPC (Phase 5)
- ❌ `study_sessions` (Phase 6)
- ❌ `daily_goals` (Phase 7)
- ❌ `import_jobs` (Phase 8)

**Schema Highlights** (from DATA_OWNERSHIP_CONTRACT.md):
- All tables have `user_id` column (except auth.users)
- Composite foreign keys enforce same-owner relationships
- RLS policies on all tables (SELECT/INSERT/UPDATE/DELETE)
- Soft delete with `deleted_at` column
- All SQL labeled as "PROPOSED: Not migration-ready"

**Safety Rules**:
1. **Cloud dev is disposable**: May be reset or recreated at any time
2. **No production data in dev**: `vocabtoeic-dev` must NEVER contain real user data
3. **Git is source of truth**: All schema changes must exist as migration files in Git
4. **No Dashboard-only changes**: SQL Editor changes without migrations are forbidden
5. **Production is separate**: `vocabtoeic-prod` is a different project, accessed only in Phase 10
6. **Never link to production**: Do not run `supabase link` against production project reference during development
7. **No destructive production commands**: Never run `db reset` or `db push --destructive` against a production-linked repository

**Acceptance Criteria**:
- `vocabtoeic-dev` cloud project created
- `supabase/` directory created with versioned migrations
- Repository linked to correct dev project reference (`supabase/.temp/project-ref` contains dev ref)
- `npx supabase db push` succeeds without errors
- Schema exists on cloud dev (verify in Supabase Dashboard)
- RLS policies enabled (verify with cross-user test accounts)
- Seed data loads correctly
- Migration files committed to Git
- Supabase client initialized but NOT yet connected to app features
- Application still uses localStorage (no functional changes)
- No production deployment performed

**Rollback**: Delete `supabase/` directory, remove Supabase client file, reset cloud dev project

**Commit Strategy**: "feat: Phase 1 — Cloud Development Supabase Foundation with versioned migrations"

---

## Phase 2 — Authentication and First Vertical Slice

**Status**: ✅ COMPLETED

**Goal**: Add `/login` and `/signup` routes, persist collections/topics/vocabularies to Supabase, verify RLS isolation.

**Prerequisites**:
- Phase 1 completed (cloud dev Supabase running with schema deployed)
- Approved from ROUTE_CONTRACT.md Section 4 (Phase 2 routes)
- Approved from PRODUCT_DECISIONS.md Section 2.6 (First Vertical Slice)

**Completion Summary**:
- ✅ Created `/login` and `/signup` pages
- ✅ Added middleware to protect `/`
- ✅ Implemented Supabase Auth (email/password)
- ✅ Persisted collections, topics, vocabularies to Supabase
- ✅ Added RLS enforcement for these entities
- ✅ Removed localStorage for migrated entities
- ✅ Verified first vertical slice with multi-user test

---

## Phase 2B.5 — Public Landing Page and Protected `/app` Route

**Status**: ✅ COMPLETED

**Goal**: Move authenticated application to `/app` and create public landing page at `/`.

**Prerequisites**:
- Phase 2B completed (route protection implemented)

**Completion Summary**:
- ✅ Moved authenticated app from `/` to `/app/page.tsx`
- ✅ Created public landing page at `/`
- ✅ Updated middleware to protect `/app` and `/app/*`
- ✅ Kept `/` public for all visitors
- ✅ Updated all auth redirects from `/` to `/app`
- ✅ Updated safe redirect default from `/` to `/app`
- ✅ Preserved all existing application behavior at `/app`
- ✅ Updated route documentation

**Landing Page Sections**:
- Public navigation (logo, login, signup CTAs)
- Hero section with value proposition
- Core benefits (SRS, organization, progress tracking)
- SRS explanation (Again/Hard/Good/Easy)
- Organization flow (Collection → Topic → Vocabulary → Session)
- Final CTA
- Footer

**Route Structure After Phase 2B.5**:
```
/              → Public landing page
/login         → Public
/signup        → Public
/auth/callback → Public
/app           → Protected authenticated application
/app/*         → Protected
```

---

## Phase 3 — Remaining Vocabulary CRUD

**Status**: 🔄 PENDING

**Goal**: Complete vocabulary features (import, export, search, filtering) using Supabase.

**Prerequisites**:
- Phase 2 completed (auth + basic CRUD working)

**Scope**:
✅ **Allowed**:
- Migrate Excel import to use Supabase
- Add search/filter queries to VocabManager
- Add SQL script generation modal (connects to Supabase)
- Remove all remaining localStorage usage for vocabularies

❌ **Not Allowed**:
- Migrate SRS progress (Phase 5)
- Add offline sync (out of scope)

**Tasks**:
1. Update Excel import to insert via Supabase
2. Add search query to VocabManager (filter by word/meaning)
3. Add filter by collection/topic/status
4. Update SQL script modal to read from Supabase
5. Remove localStorage usage for vocabularies
6. Test bulk operations (import 100+ words)

**Acceptance Criteria**:
- Excel import works with Supabase
- Search/filter functional in VocabManager
- No localStorage usage for vocabulary entities
- Performance acceptable (<500ms for 1000 vocabularies)

**Rollback**: Restore localStorage for import/export

**Commit Strategy**: "feat: Phase 3 — Complete vocabulary CRUD"

---

## Phase 4 — Current SRS Domain Extraction

**Status**: 🔄 PENDING

**Goal**: Extract current SRS algorithm into pure domain functions (no algorithm changes).

**Prerequisites**:
- Phase 3 completed
- SRS_TARGET_SPEC.md Section 2.1 approved (preserve current algorithm)

**Scope**:
✅ **Allowed**:
- Create `lib/srs/scheduler.ts` with pure functions
- Extract scheduling logic from `services/vocabService.ts`
- Add explicit timestamp parameter (no `Date.now()` inside domain)
- Write comprehensive unit tests
- Verify behavior unchanged (same inputs → same outputs)

❌ **Not Allowed**:
- Change algorithm multipliers (keep Again=5min, Hard=6h/×2, Good=24h/×3, Easy=72h/×4)
- Add ease_factor, relearning steps, interval cap
- Change states (keep 'new', 'learning', 'mastered' only)
- Add auto-mastery

**File Structure**:
```
lib/
  └── srs/
        ├── scheduler.ts          # Pure domain functions
        ├── scheduler.test.ts     # Unit tests (fixed timestamps)
        └── types.ts              # Domain types
```

**Tasks**:
1. Create `lib/srs/scheduler.ts`
2. Implement `calculateNextReview(progress, rating, nowMs)` with current algorithm
3. Move logic from `services/vocabService.ts` lines 597-619
4. Add explicit `nowMs` parameter (not `Date.now()`)
5. Write unit tests with fixed timestamps
6. Verify all tests pass
7. Update `vocabService.ts` to call domain function

**Acceptance Criteria**:
- Domain function is pure (no side effects)
- Uses fixed timestamps in tests (no `Date.now()` in assertions)
- 100% test coverage for scheduling logic
- Behavior unchanged (existing app works identically)
- All tests pass

**Rollback**: Keep scheduling logic in `vocabService.ts`

**Commit Strategy**: "refactor: Phase 4 — Extract SRS domain logic"

---

## Phase 5 — SRS Persistence and Reliability

**Status**: 🔄 PENDING

**Goal**: Add database persistence for progress and review logs, implement atomic RPC with idempotency.

**Prerequisites**:
- Phase 4 completed (domain extraction done)
- SRS_TARGET_SPEC.md Section 2.4 approved (atomic RPC pattern)

**Scope**:
✅ **Allowed**:
- Create `review_logs` table
- Implement `submit_vocabulary_rating` RPC (server-side calculation)
- Add idempotency_key to prevent duplicate submissions
- Migrate client to call RPC instead of direct progress update
- Remove localStorage for user_vocab_progress

❌ **Not Allowed**:
- Change algorithm (keep current behavior)
- Add enhanced SRS features (Phase 11+)

**File Structure**:
```
supabase/
  └── migrations/
        ├── 20260730_004_review_logs.sql
        └── 20260730_005_submit_rating_rpc.sql

services/
  └── vocabService.ts  # Update to call RPC
```

**Tasks**:
1. Create migration 004: `review_logs` table with idempotency_key
2. Create migration 005: `submit_vocabulary_rating` RPC function
3. Implement server-side scheduling calculation in RPC
4. Add idempotency check (return if key already processed)
5. Update client to call RPC with vocabulary_id + rating + idempotency_key
6. Test duplicate submission protection
7. Remove localStorage for progress

**RPC Signature** (from SRS_TARGET_SPEC.md Section 2.4):
```sql
CREATE OR REPLACE FUNCTION submit_vocabulary_rating(
  p_vocabulary_id UUID,
  p_rating TEXT,
  p_idempotency_key UUID,
  p_reviewed_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSON
```

**Acceptance Criteria**:
- Review logs persisted to database
- RPC calculates intervals server-side (browser cannot manipulate)
- Idempotency prevents duplicate submissions
- Atomic transaction (progress + log updated together)
- Flashcard mode works with Supabase-backed progress
- No localStorage usage for progress

**Rollback**: Restore localStorage for progress

**Commit Strategy**: "feat: Phase 5 — SRS persistence with atomic RPC"

---

## Phase 6 — Study Session Recovery

**Status**: 🔄 PENDING

**Goal**: Preserve active study session state (bounded, session-scoped only).

**Prerequisites**:
- Phase 5 completed

**Scope**:
✅ **Allowed**:
- Store active session state (current card index, topic, filter)
- Restore session on page refresh (same session only)
- Clear session on logout or explicit exit

❌ **Not Allowed**:
- Long-term session persistence (no unbounded growth)
- Offline queue (out of scope)

**Tasks**:
1. Store active session in sessionStorage (not localStorage)
2. Restore on page load if session valid
3. Clear on logout
4. Add "Resume Session" button on Dashboard

**Acceptance Criteria**:
- Session survives page refresh
- Session cleared on logout
- No unbounded localStorage growth

**Rollback**: Remove session recovery

**Commit Strategy**: "feat: Phase 6 — Study session recovery"

---

## Phase 7 — Dashboard Real Data

**Status**: 🔄 PENDING

**Goal**: Connect Dashboard stats to real Supabase data.

**Prerequisites**:
- Phase 5 completed (progress in database)

**Scope**:
✅ **Allowed**:
- Query real stats from user_vocab_progress
- Display due vocabulary count
- Show daily goal progress
- Calculate streak from review_logs

❌ **Not Allowed**:
- Change UI (preserve current design)

**Tasks**:
1. Query `SELECT status, COUNT(*) FROM user_vocab_progress GROUP BY status`
2. Query due count: `WHERE next_review_at <= NOW()`
3. Calculate streak from review_logs (consecutive days with reviews)
4. Update Dashboard to use real data

**Acceptance Criteria**:
- Stats reflect actual user progress
- Due count accurate
- Streak calculated correctly
- Performance acceptable (<200ms query time)

**Rollback**: Restore mock data

**Commit Strategy**: "feat: Phase 7 — Dashboard real data"

---

## Phase 8 — Import and Export

**Status**: 🔄 PENDING

**Goal**: Bulk import from Excel/CSV, export user data.

**Prerequisites**:
- Phase 3 completed (vocabulary CRUD working)

**Scope**:
✅ **Allowed**:
- Excel import (existing feature, verify with Supabase)
- Add CSV export
- Add JSON export (backup format)

❌ **Not Allowed**:
- Anki import/export (deferred)
- Automatic sync (out of scope)

**Tasks**:
1. Verify Excel import works with Supabase
2. Add CSV export button
3. Add JSON export (all user data)
4. Test with 1000+ vocabularies

**Acceptance Criteria**:
- Import handles 1000+ rows
- Export includes all user data
- Performance acceptable

**Rollback**: Remove export features

**Commit Strategy**: "feat: Phase 8 — Import and export"

---

## Phase 9 — Testing and Hardening

**Status**: 🔄 PENDING

**Goal**: Add comprehensive tests and fix bugs.

**Prerequisites**:
- Phases 1-8 completed

**Scope**:
✅ **Allowed**:
- Unit tests (domain services)
- Integration tests (repositories)
- Component tests (React components)
- E2E tests (full user flows)
- Bug fixes
- Performance optimization
- Accessibility audit

❌ **Not Allowed**:
- New features
- UI changes (unless fixing accessibility bugs)

**Tasks**:
1. Write unit tests for SRS scheduler (if not done in Phase 4)
2. Write integration tests for repositories
3. Write component tests for Flashcard, Quiz, VocabManager
4. Write E2E tests for first vertical slice
5. Run accessibility audit (WCAG AA)
6. Fix identified bugs
7. Optimize slow queries

**Test Coverage Target**:
- Domain services: 100%
- Repositories: 80%
- Components: 70%
- E2E: Critical paths covered

**Acceptance Criteria**:
- All tests pass
- Coverage targets met
- No critical bugs
- WCAG AA compliance verified (with notes on manual testing required)

**Rollback**: N/A (tests only)

**Commit Strategy**: Multiple commits per test suite

---

## Phase 10 — Production Deployment

**Status**: 🔄 PENDING

**Goal**: Deploy to production Supabase and hosting platform.

**Prerequisites**:
- Phase 9 completed (all tests pass)
- Product owner approval for production deployment

**Scope**:
✅ **Allowed**:
- Create production Supabase project
- Run migrations on production database
- Deploy Next.js app to Vercel/Netlify
- Configure environment variables
- Setup domain and SSL
- Add monitoring (optional)

❌ **Not Allowed**:
- New features
- Breaking changes

**Tasks**:
1. Create production Supabase project
2. Run migrations: `supabase db push`
3. Configure production environment variables
4. Deploy Next.js app
5. Verify first vertical slice works in production
6. Test with real users
7. Monitor for errors

**Acceptance Criteria**:
- Production app accessible at domain
- HTTPS enabled
- Database migrations applied
- RLS enforced
- No critical errors in production

**Rollback**: Revert to previous deployment

**Commit Strategy**: "deploy: Phase 10 — Production deployment"

---

## Deferred: SRS Algorithm Research and Enhancement

**Status**: 🔮 DEFERRED (Requires explicit product owner approval)

**Goal**: Research and implement enhanced SRS algorithm (Modified SM-2 or FSRS).

**Prerequisites**:
- Phase 10 completed (production stable)
- User feedback collected
- Product owner decision on algorithm enhancement
- A/B testing framework ready

**Scope** (if approved):
✅ **Allowed**:
- Add ease_factor field to user_vocab_progress
- Implement Modified SM-2 with ease adjustment
- Add relearning steps for lapses
- Add interval cap (max 365 days)
- Add auto-mastery promotion
- A/B test new algorithm vs current

❌ **Not Allowed**:
- Remove current algorithm (must coexist for A/B testing)
- Force users to new algorithm (opt-in or gradual rollout)

**Tasks** (if approved):
1. Literature review of SM-2 variants and FSRS
2. Design enhanced algorithm
3. Add ease_factor field (migration)
4. Implement new scheduler alongside current
5. Create A/B testing framework
6. Run A/B test with real users
7. Collect feedback
8. Decide: rollout, revert, or iterate

**Decision Required**: Product owner must explicitly approve before starting this phase.

**Reference**: SRS_TARGET_SPEC.md Section 4 (Deferred: Algorithm Research)

---

## Deferred: Full Routing Migration

**Status**: 🔮 DEFERRED (Requires explicit product owner approval)

**Goal**: Migrate from SPA tabs to full Next.js App Router.

**Prerequisites**:
- Phase 10 completed
- Product owner decision on routing strategy
- User feedback on navigation

**Scope** (if approved):
✅ **Allowed**:
- Move `/` → `/dashboard`
- Create `/flashcards`, `/quiz`, `/vocabularies` routes
- Add deep linking with URL parameters
- Update Navbar to use Next.js Link

❌ **Not Allowed**:
- Break existing bookmarks (redirect `/` → `/dashboard`)
- Remove SPA functionality until routing stable

**Tasks** (if approved):
1. Move current app to `/dashboard`
2. Create separate routes for flashcards, quiz, vocabularies
3. Add URL parameters (topic_id, status, etc.)
4. Update Navbar navigation
5. Test browser back/forward
6. Ensure refresh preserves state

**Decision Required**: Product owner must explicitly approve timeline and approach.

**Reference**: ROUTE_CONTRACT.md Section 5 (Deferred: Full Routing Migration)

---

## Deferred: Advanced Features

**Status**: 🔮 OUT OF SCOPE for MVP

**Not Approved**:
- Social features (friends, sharing)
- Leaderboard
- AI-powered recommendations
- Marketplace
- Multi-language UI
- Native mobile apps
- Offline-first architecture
- Advanced analytics dashboard

**Reference**: PRODUCT_DECISIONS.md Section 6 (Out of Scope)

---

## Document Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-30 | Phase 0 | Initial phased roadmap |
| 2.0 | 2026-07-30 | Phase 0 Correction | Rewrote to align with approved decisions: Phase 1 local Supabase only (no production deployment), Phase 2 adds /login and /signup with first vertical slice, Phase 4 extracts current algorithm (no changes), Phase 5 adds atomic RPC, moved SRS algorithm enhancement to deferred section, moved full routing to deferred section, clarified localStorage removal strategy |
| 3.0 | 2026-07-30 | Phase 0 Cloud Adaptation | Adapted Phase 1 to cloud-first development: use vocabtoeic-dev cloud project instead of local Docker, removed Docker/supabase start requirements, use npx supabase commands, added safety rules for cloud dev vs production separation, limited Phase 1 schema scope (defer user_vocab_progress and review_logs to Phase 5) |
| 4.0 | 2026-07-30 | Phase 2B.5 | Marked Phase 2 as COMPLETED. Added Phase 2B.5 completion summary: public landing page at `/`, authenticated app at `/app`, updated all redirects, preserved existing app behavior |

**Approval Status**: ✅ Phases 0-2B.5 completed. Phase 3+ pending. Deferred phases require separate approval.